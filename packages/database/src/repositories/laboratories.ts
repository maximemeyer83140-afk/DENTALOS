import type { LabCase, LabCaseStatus, Laboratory } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface CreateLaboratoryInput {
  name: string;
  addressLine1?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  notes?: string | undefined;
}

/** Laboratories belong to the organization, not a single clinic — the same prothésiste travaille
 * en général pour plusieurs cabinets d'un même groupe (même principe que `Supplier`). */
export async function listLaboratories(ctx: TenantContext): Promise<Laboratory[]> {
  return prisma.laboratory.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { name: "asc" },
  });
}

export async function createLaboratory(ctx: TenantContext, input: CreateLaboratoryInput): Promise<Laboratory> {
  return prisma.laboratory.create({ data: { organizationId: ctx.organizationId, ...input } });
}

export interface CreateLabCaseInput {
  patientId: string;
  practitionerId: string;
  laboratoryId: string;
  toothNumber?: number | undefined;
  workType: string;
  expectedAt?: Date | undefined;
  cost?: number | undefined;
}

export interface ListLabCasesOptions {
  statuses?: LabCaseStatus[] | undefined;
}

const OPEN_STATUSES: LabCaseStatus[] = ["to_send", "sent", "in_production", "received", "fitted"];

export type LabCaseWithRelations = LabCase & {
  patient: { id: string; firstName: string; lastName: string };
  laboratory: { id: string; name: string };
};

export async function listLabCases(ctx: TenantContext, options: ListLabCasesOptions = {}): Promise<LabCaseWithRelations[]> {
  return prisma.labCase.findMany({
    where: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      status: { in: options.statuses ?? OPEN_STATUSES },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      laboratory: { select: { id: true, name: true } },
    },
    // Échéance la plus proche d'abord (sans échéance en dernier) — même logique que le worklist
    // des tâches (Phase 7) : un cas de labo en retard doit se voir en premier.
    orderBy: [{ expectedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
}

export async function listLabCasesForPatient(ctx: TenantContext, patientId: string): Promise<LabCaseWithRelations[]> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  return prisma.labCase.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      laboratory: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createLabCase(ctx: TenantContext, input: CreateLabCaseInput): Promise<LabCase> {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${input.patientId} not found`);

  const practitioner = await prisma.practitioner.findFirst({
    where: { id: input.practitionerId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!practitioner) throw new NotFoundError(`Practitioner ${input.practitionerId} not found`);

  const laboratory = await prisma.laboratory.findFirst({
    where: { id: input.laboratoryId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!laboratory) throw new NotFoundError(`Laboratory ${input.laboratoryId} not found`);

  return prisma.labCase.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      laboratoryId: input.laboratoryId,
      toothNumber: input.toothNumber,
      workType: input.workType,
      expectedAt: input.expectedAt,
      cost: input.cost,
    },
  });
}

/** Advancing a case's status auto-stamps `sentAt`/`receivedAt` the first time it passes through
 * `sent`/`received` — the date the lab actually got or returned the case is exactly what those
 * two timestamps mean, never something a practitioner should have to type in separately from the
 * status change that makes it true. */
export async function updateLabCaseStatus(ctx: TenantContext, caseId: string, status: LabCaseStatus): Promise<LabCase> {
  const data: { status: LabCaseStatus; sentAt?: Date; receivedAt?: Date } = { status };
  if (status === "sent") data.sentAt = new Date();
  if (status === "received") data.receivedAt = new Date();

  const result = await prisma.labCase.updateMany({
    where: { id: caseId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data,
  });
  if (result.count === 0) throw new NotFoundError(`Lab case ${caseId} not found`);

  return prisma.labCase.findFirstOrThrow({ where: { id: caseId, organizationId: ctx.organizationId, clinicId: ctx.clinicId } });
}
