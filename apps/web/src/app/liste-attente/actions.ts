"use server";

import { revalidatePath } from "next/cache";

import { addToWaitingList, removeFromWaitingList } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { addToWaitingListSchema } from "@/lib/validation/waiting-list";

export interface ActionState {
  error?: string;
}

export async function addToWaitingListAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = addToWaitingListSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.write");
  try {
    await addToWaitingList(ctx, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible d'ajouter à la liste d'attente." };
  }

  revalidatePath("/liste-attente");
  return {};
}

export async function removeFromWaitingListAction(entryId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const status = formData.get("status") === "scheduled" ? "scheduled" : "cancelled";

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "agenda.write");
  await removeFromWaitingList(ctx, entryId, status);

  revalidatePath("/liste-attente");
  return {};
}
