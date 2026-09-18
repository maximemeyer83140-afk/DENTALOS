import type {
  Prisma,
  TreatmentPlan,
  TreatmentPlanItemStatus,
  TreatmentPlanOption,
  TreatmentPlanStatus,
} from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface TreatmentPlanItemInput {
  description: string;
  toothNumber?: number | undefined;
  quantity?: number | undefined;
  unitPrice: number;
  tariffItemId?: string | undefined;
  practitionerId?: string | undefined;
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

export async function createTreatmentPlan(
  ctx: TenantContext,
  patientId: string,
  input: CreateTreatmentPlanInput,
  createdBy: string,
): Promise<TreatmentPlanWithOptions> {
  await assertPatientInTenant(ctx, patientId);

  return prisma.treatmentPlan.create({
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
                sequence: index,
              })),
            },
          },
        ],
      },
    },
    include: PLAN_WITH_OPTIONS_INCLUDE,
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
 * don't carry organizationId/clinicId themselves. */
export async function updateTreatmentPlanItemStatus(
  ctx: TenantContext,
  itemId: string,
  status: TreatmentPlanItemStatus,
): Promise<void> {
  const result = await prisma.treatmentPlanItem.updateMany({
    where: {
      id: itemId,
      treatmentPlanOption: { treatmentPlan: { organizationId: ctx.organizationId, clinicId: ctx.clinicId } },
    },
    data: { status },
  });
  if (result.count === 0) throw new NotFoundError(`Treatment plan item ${itemId} not found`);
}
