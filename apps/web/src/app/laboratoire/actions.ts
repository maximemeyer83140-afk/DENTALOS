"use server";

import { revalidatePath } from "next/cache";

import { createLaboratory, updateLabCaseStatus } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { createLaboratorySchema, updateLabCaseStatusSchema } from "@/lib/validation/laboratory";

export interface ActionState {
  error?: string;
}

export async function createLaboratoryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createLaboratorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "laboratory.write");
  await createLaboratory(ctx, parsed.data);

  revalidatePath("/laboratoire");
  return {};
}

/** Same repository call as the patient-fiche "Clinique" tab's action, but revalidates the
 * clinic-wide worklist instead of a patient page. */
export async function updateLabCaseStatusFromDashboardAction(
  labCaseId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateLabCaseStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "laboratory.write");
  await updateLabCaseStatus(ctx, labCaseId, parsed.data.status);

  revalidatePath("/laboratoire");
  return {};
}
