import type { Recall, RecallStatus } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface CreateRecallInput {
  patientId: string;
  dueDate: Date;
  reason?: string | undefined;
  notes?: string | undefined;
}

export interface ListRecallsOptions {
  /** Defaults to every open status (to_contact / contacted / scheduled) — the worklist view never
   * wants to show declined/no_response entries unless explicitly asked. */
  statuses?: RecallStatus[] | undefined;
  dueBefore?: Date | undefined;
  patientId?: string | undefined;
}

const OPEN_STATUSES: RecallStatus[] = ["to_contact", "contacted", "scheduled"];

export type RecallWithPatient = Recall & {
  patient: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null };
};

/** Clinic-wide worklist, oldest due date first — this is the dashboard that makes recalls
 * actionable instead of a Recall row nobody ever looks at again. */
export async function listRecalls(
  ctx: TenantContext,
  options: ListRecallsOptions = {},
): Promise<RecallWithPatient[]> {
  return prisma.recall.findMany({
    where: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      status: { in: options.statuses ?? OPEN_STATUSES },
      ...(options.dueBefore ? { dueDate: { lte: options.dueBefore } } : {}),
      ...(options.patientId ? { patientId: options.patientId } : {}),
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function listRecallsForPatient(ctx: TenantContext, patientId: string): Promise<Recall[]> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  return prisma.recall.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { dueDate: "desc" },
  });
}

export async function createRecall(ctx: TenantContext, input: CreateRecallInput): Promise<Recall> {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${input.patientId} not found`);

  return prisma.recall.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      dueDate: input.dueDate,
      reason: input.reason,
      notes: input.notes,
    },
  });
}

export async function updateRecallStatus(
  ctx: TenantContext,
  recallId: string,
  status: RecallStatus,
  notes?: string | undefined,
): Promise<Recall> {
  const result = await prisma.recall.updateMany({
    where: { id: recallId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: { status, ...(notes !== undefined ? { notes } : {}) },
  });
  if (result.count === 0) throw new NotFoundError(`Recall ${recallId} not found`);

  return prisma.recall.findFirstOrThrow({
    where: { id: recallId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
}
