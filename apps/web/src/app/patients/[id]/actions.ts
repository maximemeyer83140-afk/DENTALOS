"use server";

import { revalidatePath } from "next/cache";

import {
  addAlert,
  createNote,
  createQuoteFromPlanOption,
  createTreatmentPlan,
  finalizeNote,
  recordToothCondition,
  updateMedicalProfile,
} from "@dentalos/database";
import type { DentalConditionType } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { addAlertSchema, updateMedicalProfileSchema } from "@/lib/validation/medical-profile";
import { createNoteSchema, createTreatmentPlanSchema } from "@/lib/validation/clinical";

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

export async function createTreatmentPlanAction(
  patientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createTreatmentPlanSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "clinical.write");
  await createTreatmentPlan(
    ctx,
    patientId,
    {
      practitionerId: parsed.data.practitionerId,
      optionLabel: "Option A",
      items: [
        {
          description: parsed.data.description,
          unitPrice: parsed.data.unitPrice,
          toothNumber: parsed.data.toothNumber,
        },
      ],
    },
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
