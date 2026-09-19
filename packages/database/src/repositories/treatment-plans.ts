import type {
  Prisma,
  TreatmentPlan,
  TreatmentPlanItemStatus,
  TreatmentPlanOption,
  TreatmentPlanStatus,
} from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import { computeSoinStatus, type SoinStatus } from "../services/treatment-status";
import type { TenantContext } from "../tenant-context";

export interface TreatmentPlanItemInput {
  description: string;
  toothNumber?: number | undefined;
  quantity?: number | undefined;
  unitPrice: number;
  tariffItemId?: string | undefined;
  practitionerId?: string | undefined;
  /** Defaults to "planned" (a proposal — the "Devis" path). Pass "completed" for acts actually
   * performed today (the "Traitement" path) — same items/options/quotes machinery either way, only
   * the starting point in the TreatmentPlanItemStatus workflow differs. */
  status?: TreatmentPlanItemStatus | undefined;
}

export interface CreateTreatmentPlanInput {
  practitionerId: string;
  title?: string | undefined;
  optionLabel: string;
  optionDescription?: string | undefined;
  items: TreatmentPlanItemInput[];
}

const PLAN_WITH_OPTIONS_INCLUDE = { options: { include: { items: true } } } satisfies Prisma.TreatmentPlanInclude;

export type TreatmentPlanWithOptions = Prisma.TreatmentPlanGetPayload<{
  include: typeof PLAN_WITH_OPTIONS_INCLUDE;
}>;

async function assertPatientInTenant(ctx: TenantContext, patientId: string): Promise<void> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);
}

export async function listTreatmentPlansForPatient(
  ctx: TenantContext,
  patientId: string,
): Promise<TreatmentPlanWithOptions[]> {
  return prisma.treatmentPlan.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: PLAN_WITH_OPTIONS_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Items created with `status: "completed"` (the "Traitement" path — an act performed today, as
 * opposed to a "Devis" proposal) each get a matching `Treatment` record in the same transaction —
 * that record is what lets ÉTAPE 6's per-acte status ("réalisé" / "à facturer" / "facturé" /
 * "payé") and a later invoice line trace back to what was actually done, instead of the plan item
 * (a proposal) and the billing (a fact) drifting apart with nothing linking them.
 */
export async function createTreatmentPlan(
  ctx: TenantContext,
  patientId: string,
  input: CreateTreatmentPlanInput,
  createdBy: string,
): Promise<TreatmentPlanWithOptions> {
  await assertPatientInTenant(ctx, patientId);

  return prisma.$transaction(async (tx) => {
    const plan = await tx.treatmentPlan.create({
      data: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        patientId,
        practitionerId: input.practitionerId,
        title: input.title,
        createdBy,
        options: {
          create: [
            {
              label: input.optionLabel,
              description: input.optionDescription,
              isSelected: true,
              items: {
                create: input.items.map((item, index) => ({
                  description: item.description,
                  toothNumber: item.toothNumber,
                  quantity: item.quantity ?? 1,
                  unitPrice: item.unitPrice,
                  tariffItemId: item.tariffItemId,
                  practitionerId: item.practitionerId,
                  status: item.status,
                  sequence: index,
                })),
              },
            },
          ],
        },
      },
      include: PLAN_WITH_OPTIONS_INCLUDE,
    });

    const createdItems = plan.options[0]?.items ?? [];
    for (const item of createdItems) {
      if (item.status !== "completed") continue;
      await tx.treatment.create({
        data: {
          organizationId: ctx.organizationId,
          clinicId: ctx.clinicId,
          patientId,
          practitionerId: item.practitionerId ?? input.practitionerId,
          treatmentPlanItemId: item.id,
          tariffItemId: item.tariffItemId,
          toothNumber: item.toothNumber,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          status: "completed",
          createdBy,
        },
      });
    }

    return plan;
  });
}

export async function addTreatmentPlanOption(
  ctx: TenantContext,
  treatmentPlanId: string,
  label: string,
  description: string | undefined,
  items: TreatmentPlanItemInput[],
): Promise<TreatmentPlanOption> {
  const plan = await prisma.treatmentPlan.findFirst({
    where: { id: treatmentPlanId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!plan) throw new NotFoundError(`Treatment plan ${treatmentPlanId} not found`);

  return prisma.treatmentPlanOption.create({
    data: {
      treatmentPlanId,
      label,
      description,
      items: {
        create: items.map((item, index) => ({
          description: item.description,
          toothNumber: item.toothNumber,
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice,
          tariffItemId: item.tariffItemId,
          practitionerId: item.practitionerId,
          sequence: index,
        })),
      },
    },
  });
}

export async function updateTreatmentPlanStatus(
  ctx: TenantContext,
  treatmentPlanId: string,
  status: TreatmentPlanStatus,
): Promise<TreatmentPlan> {
  const result = await prisma.treatmentPlan.updateMany({
    where: { id: treatmentPlanId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: { status },
  });
  if (result.count === 0) throw new NotFoundError(`Treatment plan ${treatmentPlanId} not found`);
  const plan = await prisma.treatmentPlan.findFirst({ where: { id: treatmentPlanId } });
  if (!plan) throw new NotFoundError(`Treatment plan ${treatmentPlanId} not found`);
  return plan;
}

/** Verifies tenant ownership through the option's parent plan before touching an item — items
 * don't carry organizationId/clinicId themselves. Moving an item to "completed" here (as opposed
 * to it starting there via the "Traitement" mode of `createTreatmentPlan`) creates its `Treatment`
 * record at that point instead — same rule either way: a plan item becomes traceable to a real,
 * billable act exactly once, the moment it is first marked completed. */
export async function updateTreatmentPlanItemStatus(
  ctx: TenantContext,
  itemId: string,
  status: TreatmentPlanItemStatus,
  updatedBy: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await tx.treatmentPlanItem.findFirst({
      where: {
        id: itemId,
        treatmentPlanOption: { treatmentPlan: { organizationId: ctx.organizationId, clinicId: ctx.clinicId } },
      },
      include: { treatmentPlanOption: { include: { treatmentPlan: true } }, treatments: true },
    });
    if (!item) throw new NotFoundError(`Treatment plan item ${itemId} not found`);

    await tx.treatmentPlanItem.update({ where: { id: itemId }, data: { status } });

    if (status === "completed" && item.treatments.length === 0) {
      const plan = item.treatmentPlanOption.treatmentPlan;
      await tx.treatment.create({
        data: {
          organizationId: ctx.organizationId,
          clinicId: ctx.clinicId,
          patientId: plan.patientId,
          practitionerId: item.practitionerId ?? plan.practitionerId,
          treatmentPlanItemId: item.id,
          tariffItemId: item.tariffItemId,
          toothNumber: item.toothNumber,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          status: "completed",
          createdBy: updatedBy,
        },
      });
    }
  });
}

export interface SoinRow {
  id: string;
  /** The linked `Treatment`'s id, when the act has been realized — ÉTAPE 8 needs this to invoice
   * a "réalisé non facturé" act directly (`createInvoiceFromTreatments`), separately from
   * `id` (the plan item this row is about). Null until the act is actually performed. */
  treatmentId: string | null;
  description: string;
  toothNumber: number | null;
  practitionerName: string;
  tariffCode: string | null;
  unitPrice: number;
  quantity: number;
  status: SoinStatus;
  performedAt: Date | null;
}

/**
 * Every soin/acte across all of a patient's treatment plans, flat, with the ÉTAPE 6 status
 * computed per row (see computeSoinStatus) — this is what the "Clinique / Soins" tab's status
 * table reads from, so "prévu / réalisé / à facturer / facturé / payé" is always read off the real
 * plan/treatment/invoice chain, never a cached or separately-maintained value.
 */
export async function listSoinsForPatient(ctx: TenantContext, patientId: string): Promise<SoinRow[]> {
  await assertPatientInTenant(ctx, patientId);

  const items = await prisma.treatmentPlanItem.findMany({
    where: {
      treatmentPlanOption: {
        treatmentPlan: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
      },
    },
    include: {
      tariffItem: { select: { code: true } },
      practitioner: { select: { firstName: true, lastName: true } },
      treatmentPlanOption: {
        include: { treatmentPlan: { include: { practitioner: { select: { firstName: true, lastName: true } } } } },
      },
      treatments: { include: { invoiceItems: { include: { invoice: { select: { status: true } } } } } },
    },
    orderBy: [{ treatmentPlanOption: { treatmentPlan: { createdAt: "desc" } } }, { sequence: "asc" }],
  });

  return items.map((item): SoinRow => {
    const treatment = item.treatments[0];
    const invoiceItem = treatment?.invoiceItems[0];
    const status = computeSoinStatus({
      itemStatus: item.status,
      hasTreatment: Boolean(treatment),
      hasInvoiceItem: Boolean(invoiceItem),
      invoiceStatus: invoiceItem?.invoice.status,
    });
    const practitioner = item.practitioner ?? item.treatmentPlanOption.treatmentPlan.practitioner;
    return {
      id: item.id,
      treatmentId: treatment?.id ?? null,
      description: item.description,
      toothNumber: item.toothNumber,
      practitionerName: `${practitioner.firstName} ${practitioner.lastName}`,
      tariffCode: item.tariffItem?.code ?? null,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      status,
      performedAt: treatment?.performedAt ?? null,
    };
  });
}
