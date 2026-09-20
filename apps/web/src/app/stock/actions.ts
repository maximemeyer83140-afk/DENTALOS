"use server";

import { revalidatePath } from "next/cache";

import { adjustStock, consumeStock, createInventoryItem, createSupplier, receiveStock } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import {
  adjustStockSchema,
  consumeStockSchema,
  createInventoryItemSchema,
  createSupplierSchema,
  receiveStockSchema,
} from "@/lib/validation/inventory";

export interface ActionState {
  error?: string;
}

export async function createSupplierAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createSupplierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.write");
  await createSupplier(ctx, parsed.data);

  revalidatePath("/stock");
  return {};
}

export async function createInventoryItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createInventoryItemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.write");
  try {
    await createInventoryItem(ctx, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de créer cet article." };
  }

  revalidatePath("/stock");
  return {};
}

export async function receiveStockAction(itemId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = receiveStockSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.write");
  await receiveStock(
    ctx,
    itemId,
    { quantity: parsed.data.quantity, lotNumber: parsed.data.lotNumber, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined },
    ctx.userId,
  );

  revalidatePath("/stock");
  revalidatePath(`/stock/${itemId}`);
  return {};
}

export async function consumeStockAction(itemId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = consumeStockSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.write");
  try {
    await consumeStock(ctx, itemId, parsed.data, ctx.userId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible d'enregistrer cette consommation." };
  }

  revalidatePath("/stock");
  revalidatePath(`/stock/${itemId}`);
  return {};
}

export async function adjustStockAction(itemId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = adjustStockSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.write");
  try {
    await adjustStock(ctx, itemId, parsed.data, ctx.userId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible d'enregistrer cet ajustement." };
  }

  revalidatePath("/stock");
  revalidatePath(`/stock/${itemId}`);
  return {};
}
