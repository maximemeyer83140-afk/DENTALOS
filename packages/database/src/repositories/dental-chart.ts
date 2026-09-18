import type { DentalChart, DentalChartEntry, DentalConditionType } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export type DentalChartWithEntries = DentalChart & { entries: DentalChartEntry[] };

export interface RecordToothConditionInput {
  toothNumber: number;
  condition: DentalConditionType;
  surface?: string | undefined;
  notes?: string | undefined;
}

async function assertPatientInTenant(ctx: TenantContext, patientId: string): Promise<void> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);
}

export async function getCurrentChart(
  ctx: TenantContext,
  patientId: string,
): Promise<DentalChartWithEntries | null> {
  await assertPatientInTenant(ctx, patientId);
  return prisma.dentalChart.findFirst({
    where: { patientId, isCurrent: true },
    include: { entries: true },
  });
}

/** The odontogram as it stood at or before a given date — section 8: "consulter l'odontogramme à
 * une date antérieure". */
export async function getChartAsOf(
  ctx: TenantContext,
  patientId: string,
  asOfDate: Date,
): Promise<DentalChartWithEntries | null> {
  await assertPatientInTenant(ctx, patientId);
  return prisma.dentalChart.findFirst({
    where: { patientId, asOfDate: { lte: asOfDate } },
    orderBy: { asOfDate: "desc" },
    include: { entries: true },
  });
}

export async function listChartHistory(ctx: TenantContext, patientId: string): Promise<DentalChart[]> {
  await assertPatientInTenant(ctx, patientId);
  return prisma.dentalChart.findMany({ where: { patientId }, orderBy: { asOfDate: "desc" } });
}

/**
 * Every change creates a brand-new chart snapshot instead of mutating the current one in place —
 * the same "never silently overwrite" discipline as the medical profile (Phase 2) and finalized
 * clinical notes, and the only way "as of a past date" (above) means anything real.
 */
export async function recordToothCondition(
  ctx: TenantContext,
  patientId: string,
  input: RecordToothConditionInput,
  createdBy: string,
): Promise<DentalChartWithEntries> {
  await assertPatientInTenant(ctx, patientId);

  return prisma.$transaction(async (tx) => {
    const current = await tx.dentalChart.findFirst({
      where: { patientId, isCurrent: true },
      include: { entries: true },
    });

    if (current) {
      await tx.dentalChart.update({ where: { id: current.id }, data: { isCurrent: false } });
    }

    const carriedOverEntries = (current?.entries ?? []).filter((entry) => entry.toothNumber !== input.toothNumber);

    return tx.dentalChart.create({
      data: {
        patientId,
        isCurrent: true,
        createdBy,
        entries: {
          create: [
            ...carriedOverEntries.map((entry) => ({
              toothNumber: entry.toothNumber,
              surface: entry.surface,
              condition: entry.condition,
              notes: entry.notes,
            })),
            {
              toothNumber: input.toothNumber,
              surface: input.surface,
              condition: input.condition,
              notes: input.notes,
            },
          ],
        },
      },
      include: { entries: true },
    });
  });
}
