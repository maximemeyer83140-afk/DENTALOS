"use server";

import { revalidatePath } from "next/cache";

import { updateRecallStatus } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { updateRecallStatusSchema } from "@/lib/validation/recalls";

export interface ActionState {
  error?: string;
}

/** Same repository call as the patient-fiche "Suivi" tab's action, but revalidates the worklist
 * page instead of a patient page — the clinic-wide dashboard is the whole point of this route. */
export async function updateRecallStatusFromDashboardAction(
  recallId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateRecallStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "recalls.write");
  await updateRecallStatus(ctx, recallId, parsed.data.status, parsed.data.notes);

  revalidatePath("/rappels");
  return {};
}
