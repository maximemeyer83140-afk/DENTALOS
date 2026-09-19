"use server";

import { revalidatePath } from "next/cache";

import { createTask, updateTaskStatus } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { createTaskSchema, updateTaskStatusSchema } from "@/lib/validation/tasks";

export interface ActionState {
  error?: string;
}

export async function createTaskAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createTaskSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "tasks.write");
  await createTask(
    ctx,
    {
      title: parsed.data.title,
      description: parsed.data.description,
      assignedToUserId: parsed.data.assignedToUserId,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
    },
    ctx.userId,
  );

  revalidatePath("/taches");
  return {};
}

export async function updateTaskStatusAction(
  taskId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateTaskStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "tasks.write");
  await updateTaskStatus(ctx, taskId, parsed.data.status);

  revalidatePath("/taches");
  return {};
}
