import type { Treatment, TreatmentStatus } from "@prisma/client";

import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface CreateTreatmentInput {
  patientId: string;
  practitionerId: string;
  treatmentPlanItemId?: string | undefined;
  appointmentId?: string | undefined;
  tariffItemId?: string | undefined;
  toothNumber?: number | undefined;
  description: string;
  quantity?: number | undefined;
  unitPrice: number;
  performedAt?: Date | undefined;
  status?: TreatmentStatus | undefined;
}

/**
 * Records an actually-performed clinical act (ÉTAPE 6 — dent, date, praticien, code tarifaire,
 * description, prix, statut all live here). Kept separate from `TreatmentPlanItem` (the planned
 * line) on purpose: a plan item can be realized in more than one session, and this is the record
 * that lets a quote/invoice line trace back to what was actually done, not just what was proposed.
 */
export async function createTreatment(
  ctx: TenantContext,
  input: CreateTreatmentInput,
  createdBy: string,
): Promise<Treatment> {
  return prisma.treatment.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      treatmentPlanItemId: input.treatmentPlanItemId,
      appointmentId: input.appointmentId,
      tariffItemId: input.tariffItemId,
      toothNumber: input.toothNumber,
      description: input.description,
      quantity: input.quantity ?? 1,
      unitPrice: input.unitPrice,
      performedAt: input.performedAt,
      status: input.status,
      createdBy,
    },
  });
}

export async function listTreatmentsForPatient(ctx: TenantContext, patientId: string): Promise<Treatment[]> {
  return prisma.treatment.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { performedAt: "desc" },
  });
}
