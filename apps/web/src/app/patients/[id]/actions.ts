"use server";

import { revalidatePath } from "next/cache";

import {
  addAlert,
  computeTariffItemPrice,
  createInvoiceFromQuote,
  createNote,
  createQuoteFromPlanOption,
  createTreatmentPlan,
  finalizeNote,
  getTariffItem,
  recordPayment,
  recordToothCondition,
  updateMedicalProfile,
  validateInvoice,
} from "@dentalos/database";
import type { DentalConditionType, TreatmentPlanItemInput } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { addAlertSchema, updateMedicalProfileSchema } from "@/lib/validation/medical-profile";
import { createNoteSchema, createTreatmentPlanSchema } from "@/lib/validation/clinical";
import { recordPaymentSchema } from "@/lib/validation/billing";

export interface ActionState {
  error?: string;
}

export async function addAlertAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addAlertSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await addAlert(ctx, patientId, parsed.data, ctx.userId);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

export async function updateMedicalProfileAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateMedicalProfileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await updateMedicalProfile(ctx, patientId, parsed.data, ctx.userId);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

/** Called imperatively from the odontogram (one click = one server round trip), not bound to a
 * form — see Odontogram.tsx. */
export async function recordToothConditionAction(
  patientId: string,
  toothNumber: number,
  condition: DentalConditionType,
): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await recordToothCondition(ctx, patientId, { toothNumber, condition }, ctx.userId);
  revalidatePath(`/patients/${patientId}`);
}

export async function createNoteAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createNoteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await createNote(ctx, patientId, parsed.data, ctx.userId);

  revalidatePath(`/patients/${patientId}`);
  return {};
}

export async function finalizeNoteAction(patientId: string, noteId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await finalizeNote(ctx, noteId);
  revalidatePath(`/patients/${patientId}`);
}

/**
 * Builds a treatment plan option from one or more tariff-catalog lines (e.g. anesthésie + digue +
 * composite in a single visit). The price is never taken from the client: each line only carries a
 * `tariffItemId`, and the server re-resolves the item's real description and price from the
 * catalog under the chosen billing regime (`computeTariffItemPrice`) before writing anything — the
 * same "server is the only authority on money" rule already applied to quotes/invoices (section
 * 79). `mode` picks what the built option represents: "quote" (Devis — a proposal, items start
 * "planned", can later become a Quote) or "treatment" (Traitement — acts performed today, items
 * start "completed").
 */
export async function createTreatmentPlanAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createTreatmentPlanSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");

  const items: TreatmentPlanItemInput[] = [];
  for (const line of parsed.data.lines) {
    const tariffItem = await getTariffItem(ctx, line.tariffItemId);
    let unitPrice: number;
    try {
      unitPrice = computeTariffItemPrice({
        item: tariffItem,
        regime: parsed.data.regime,
        pointValue: parsed.data.pointValue,
        privatePoints: line.privatePoints,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "prix non calculable";
      return { error: `${tariffItem.code} — ${tariffItem.description} : ${message}` };
    }
    items.push({
      description: `${tariffItem.code} — ${tariffItem.description}`,
      toothNumber: line.toothNumber,
      quantity: line.quantity,
      unitPrice,
      tariffItemId: tariffItem.id,
      status: parsed.data.mode === "treatment" ? "completed" : undefined,
    });
  }

  const defaultLabel =
    parsed.data.mode === "treatment"
      ? `Séance du ${new Date().toLocaleDateString("fr-CH")}`
      : "Option A";

  await createTreatmentPlan(
    ctx,
    patientId,
    { practitionerId: parsed.data.practitionerId, optionLabel: parsed.data.optionLabel ?? defaultLabel, items },
    ctx.userId,
  );

  revalidatePath(`/patients/${patientId}`);
  return {};
}

export async function createQuoteAction(patientId: string, treatmentPlanOptionId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await createQuoteFromPlanOption(ctx, treatmentPlanOptionId, undefined, ctx.userId);
  revalidatePath(`/patients/${patientId}`);
}

export async function createInvoiceAction(patientId: string, quoteId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "invoices.create");
  await createInvoiceFromQuote(ctx, quoteId, undefined, ctx.userId);
  revalidatePath(`/patients/${patientId}`);
}

export async function validateInvoiceAction(patientId: string, invoiceId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "invoices.validate");
  await validateInvoice(ctx, invoiceId, ctx.userId);
  revalidatePath(`/patients/${patientId}`);
}

export async function recordPaymentAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = recordPaymentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "payments.create");
  await recordPayment(
    ctx,
    {
      patientId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference,
      allocations: [{ invoiceId: parsed.data.invoiceId, amount: parsed.data.amount }],
    },
    ctx.userId,
  );

  revalidatePath(`/patients/${patientId}`);
  return {};
}
