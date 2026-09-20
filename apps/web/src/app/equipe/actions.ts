"use server";

import { revalidatePath } from "next/cache";

import { createClinicUser, createRole, setUserStatus, updateRolePermissions, updateUserClinicRole } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { createRoleSchema, createUserSchema, updateRolePermissionsSchema, updateUserRoleSchema } from "@/lib/validation/team";
import type { UserStatus } from "@dentalos/database";

export interface ActionState {
  error?: string;
}

export async function createUserAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "users.manage");
  try {
    await createClinicUser(ctx, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de créer ce collaborateur." };
  }

  revalidatePath("/equipe");
  return {};
}

export async function updateUserRoleAction(
  userId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateUserRoleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "users.manage");
  await updateUserClinicRole(ctx, userId, parsed.data.roleId);

  revalidatePath("/equipe");
  return {};
}

/** Toggling active/suspended is a fixed one-of-two choice, not free-form user input — a plain
 * button (see `TeamMemberRow.tsx`) rather than a validated form, same pattern as
 * `setDocumentArchivedAction`. */
export async function setUserStatusAction(userId: string, status: UserStatus): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "users.manage");
  await setUserStatus(ctx, userId, status);
  revalidatePath("/equipe");
}

export async function createRoleAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createRoleSchema.safeParse({
    name: formData.get("name"),
    permissionKeys: formData.getAll("permissionKeys"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "users.manage");
  try {
    await createRole(ctx, parsed.data.name, parsed.data.permissionKeys);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de créer ce rôle." };
  }

  revalidatePath("/equipe");
  return {};
}

export async function updateRolePermissionsAction(
  roleId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateRolePermissionsSchema.safeParse({ permissionKeys: formData.getAll("permissionKeys") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "users.manage");
  await updateRolePermissions(ctx, roleId, parsed.data.permissionKeys);

  revalidatePath("/equipe");
  return {};
}
