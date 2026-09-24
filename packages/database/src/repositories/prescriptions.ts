import type { Prescription, PrescriptionItem } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface PrescriptionItemInput {
  medication: string;
  dosage: string;
  duration: string;
}

export interface CreatePrescriptionInput {
  practitionerId: string;
  notes?: string | undefined;
  items: PrescriptionItemInput[];
}

export type PrescriptionWithItems = Prescription & { items: PrescriptionItem[] };

export async function listPrescriptionsForPatient(
  ctx: TenantContext,
  patientId: string,
): Promise<PrescriptionWithItems[]> {
  return prisma.prescription.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

/** An ordonnance is always written with at least one medication line — an empty prescription isn't
 * a real clinical act. Items are created together with their parent in one write (Prisma's nested
 * `create`), so a prescription with zero items can never exist even transiently. */
export async function createPrescription(
  ctx: TenantContext,
  patientId: string,
  input: CreatePrescriptionInput,
  createdBy: string,
): Promise<PrescriptionWithItems> {
  if (input.items.length === 0) {
    throw new Error("A prescription needs at least one medication line");
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  const practitioner = await prisma.practitioner.findFirst({
    where: { id: input.practitionerId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!practitioner) throw new NotFoundError(`Practitioner ${input.practitionerId} not found`);

  return prisma.prescription.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId,
      practitionerId: input.practitionerId,
      notes: input.notes,
      createdBy,
      items: { create: input.items },
    },
    include: { items: true },
  });
}

/** Replaces the medication list and notes wholesale — matches how the "remplir directement avant
 * impression" flow works (the practitioner edits the same lines shown on the printable sheet).
 * Deletes the old lines and re-creates them in one transaction rather than diffing, since the
 * client already sends the full intended list rather than a delta. */
export async function updatePrescription(
  ctx: TenantContext,
  prescriptionId: string,
  input: { notes?: string | undefined; items: PrescriptionItemInput[] },
): Promise<PrescriptionWithItems> {
  if (input.items.length === 0) {
    throw new Error("A prescription needs at least one medication line");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.prescription.findFirst({
      where: { id: prescriptionId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError(`Prescription ${prescriptionId} not found`);

    await tx.prescriptionItem.deleteMany({ where: { prescriptionId } });
    return tx.prescription.update({
      where: { id: prescriptionId },
      data: { notes: input.notes, items: { create: input.items } },
      include: { items: true },
    });
  });
}

/** Links a prescription to the real file it was printed/exported to (see Consent.documentId for
 * the same optional-link pattern) — never set automatically, only once a Document row actually
 * exists for it. */
export async function linkPrescriptionDocument(
  ctx: TenantContext,
  prescriptionId: string,
  documentId: string,
): Promise<Prescription> {
  const result = await prisma.prescription.updateMany({
    where: { id: prescriptionId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: { documentId },
  });
  if (result.count === 0) throw new NotFoundError(`Prescription ${prescriptionId} not found`);
  return prisma.prescription.findFirstOrThrow({ where: { id: prescriptionId } });
}
