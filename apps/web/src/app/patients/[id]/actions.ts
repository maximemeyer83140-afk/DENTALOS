"use server";

import { revalidatePath } from "next/cache";

import { addAlert, updateMedicalProfile } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { addAlertSchema, updateMedicalProfileSchema } from "@/lib/validation/medical-profile";

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
