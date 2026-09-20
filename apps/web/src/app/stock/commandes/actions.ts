"use server";

import { revalidatePath } from "next/cache";

import { cancelPurchaseOrder, createPurchaseOrder, receivePurchaseOrderItems, sendPurchaseOrder } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { createPurchaseOrderSchema, receivePurchaseOrderItemsSchema } from "@/lib/validation/purchase-orders";

export interface ActionState {
  error?: string;
}

export async function createPurchaseOrderAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createPurchaseOrderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.write");
  try {
    await createPurchaseOrder(
      ctx,
      { supplierId: parsed.data.supplierId, expectedAt: parsed.data.expectedAt ? new Date(parsed.data.expectedAt) : undefined, items: parsed.data.items },
      ctx.userId,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de créer ce bon de commande." };
  }

  revalidatePath("/stock/commandes");
  return {};
}

export async function sendPurchaseOrderAction(poId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.write");
  await sendPurchaseOrder(ctx, poId);
  revalidatePath("/stock/commandes");
  revalidatePath(`/stock/commandes/${poId}`);
}

export async function cancelPurchaseOrderAction(poId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.write");
  await cancelPurchaseOrder(ctx, poId);
  revalidatePath("/stock/commandes");
  revalidatePath(`/stock/commandes/${poId}`);
}

export async function receivePurchaseOrderItemsAction(
  poId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = receivePurchaseOrderItemsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "inventory.write");
  const receipts = Object.fromEntries(parsed.data.lines.map((l) => [l.purchaseOrderItemId, l.quantityReceived]));
  try {
    await receivePurchaseOrderItems(
      ctx,
      poId,
      { receipts, lotNumber: parsed.data.lotNumber, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined },
      ctx.userId,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible d'enregistrer cette réception." };
  }

  revalidatePath("/stock");
  revalidatePath("/stock/commandes");
  revalidatePath(`/stock/commandes/${poId}`);
  return {};
}
