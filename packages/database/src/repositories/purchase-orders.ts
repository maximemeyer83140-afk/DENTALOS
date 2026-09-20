import { Prisma, type PurchaseOrder, type PurchaseOrderStatus } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import { nextPurchaseOrderNumber } from "../services/purchase-order-number";
import type { TenantContext } from "../tenant-context";
import { receiveStock } from "./inventory";

const MAX_CREATE_ATTEMPTS = 3;

export class PurchaseOrderNotEditableError extends Error {
  constructor(poId: string, status: string) {
    super(`Purchase order ${poId} cannot be changed in status "${status}"`);
    this.name = "PurchaseOrderNotEditableError";
  }
}

export type PurchaseOrderWithItems = Prisma.PurchaseOrderGetPayload<{
  include: { items: { include: { inventoryItem: { select: { name: true; sku: true; unit: true } } } }; supplier: { select: { name: true } } };
}>;

export interface CreatePurchaseOrderItemInput {
  inventoryItemId: string;
  quantityOrdered: number;
  unitCost: number;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  expectedAt?: Date | undefined;
  items: CreatePurchaseOrderItemInput[];
}

export interface ListPurchaseOrdersOptions {
  statuses?: PurchaseOrderStatus[] | undefined;
}

const OPEN_STATUSES: PurchaseOrderStatus[] = ["draft", "sent", "partially_received"];

export async function listPurchaseOrders(
  ctx: TenantContext,
  options: ListPurchaseOrdersOptions = {},
): Promise<PurchaseOrderWithItems[]> {
  return prisma.purchaseOrder.findMany({
    where: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      status: { in: options.statuses ?? OPEN_STATUSES },
    },
    include: {
      items: { include: { inventoryItem: { select: { name: true, sku: true, unit: true } } } },
      supplier: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPurchaseOrder(ctx: TenantContext, poId: string): Promise<PurchaseOrderWithItems> {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: {
      items: { include: { inventoryItem: { select: { name: true, sku: true, unit: true } } } },
      supplier: { select: { name: true } },
    },
  });
  if (!po) throw new NotFoundError(`Purchase order ${poId} not found`);
  return po;
}

export async function createPurchaseOrder(
  ctx: TenantContext,
  input: CreatePurchaseOrderInput,
  createdBy: string,
): Promise<PurchaseOrderWithItems> {
  if (input.items.length === 0) throw new Error("A purchase order must have at least one line");

  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, organizationId: ctx.organizationId } });
  if (!supplier) throw new NotFoundError(`Supplier ${input.supplierId} not found`);

  const itemIds = input.items.map((i) => i.inventoryItemId);
  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds }, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
  if (items.length !== new Set(itemIds).size) throw new NotFoundError("One or more inventory items not found");

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
    try {
      const po = await prisma.$transaction(
        async (tx) => {
          const orderNumber = await nextPurchaseOrderNumber(tx, ctx.clinicId);
          return tx.purchaseOrder.create({
            data: {
              organizationId: ctx.organizationId,
              clinicId: ctx.clinicId,
              supplierId: input.supplierId,
              orderNumber,
              expectedAt: input.expectedAt,
              createdBy,
              items: {
                create: input.items.map((item) => ({
                  inventoryItemId: item.inventoryItemId,
                  quantityOrdered: item.quantityOrdered,
                  unitCost: item.unitCost,
                })),
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return getPurchaseOrder(ctx, po.id);
    } catch (error) {
      const isRetryableConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
      if (!isRetryableConflict || attempt === MAX_CREATE_ATTEMPTS) throw error;
    }
  }
  throw new Error("createPurchaseOrder: exhausted retry attempts without a definitive result");
}

export async function sendPurchaseOrder(ctx: TenantContext, poId: string): Promise<PurchaseOrder> {
  const result = await prisma.purchaseOrder.updateMany({
    where: { id: poId, organizationId: ctx.organizationId, clinicId: ctx.clinicId, status: "draft" },
    data: { status: "sent" },
  });
  if (result.count === 0) {
    const existing = await prisma.purchaseOrder.findFirst({ where: { id: poId, organizationId: ctx.organizationId, clinicId: ctx.clinicId } });
    if (!existing) throw new NotFoundError(`Purchase order ${poId} not found`);
    throw new PurchaseOrderNotEditableError(poId, existing.status);
  }
  return prisma.purchaseOrder.findFirstOrThrow({ where: { id: poId } });
}

export async function cancelPurchaseOrder(ctx: TenantContext, poId: string): Promise<PurchaseOrder> {
  const result = await prisma.purchaseOrder.updateMany({
    where: { id: poId, organizationId: ctx.organizationId, clinicId: ctx.clinicId, status: { in: ["draft", "sent", "partially_received"] } },
    data: { status: "cancelled" },
  });
  if (result.count === 0) {
    const existing = await prisma.purchaseOrder.findFirst({ where: { id: poId, organizationId: ctx.organizationId, clinicId: ctx.clinicId } });
    if (!existing) throw new NotFoundError(`Purchase order ${poId} not found`);
    throw new PurchaseOrderNotEditableError(poId, existing.status);
  }
  return prisma.purchaseOrder.findFirstOrThrow({ where: { id: poId } });
}

export interface ReceivePurchaseOrderItemsInput {
  /** `PurchaseOrderItem.id` -> quantity received in this delivery (a PO often arrives in more
   * than one shipment, so this is on top of whatever `quantityReceived` already holds). */
  receipts: Record<string, number>;
  lotNumber?: string | undefined;
  expiresAt?: Date | undefined;
}

/**
 * Receiving a purchase order is where Stock (Phase 9) and Purchase Orders meet: each line
 * received calls `receiveStock` (creates the traceable `InventoryLot` + `receipt` movement,
 * exactly as a manual reception would) *and* bumps `PurchaseOrderItem.quantityReceived`, so the
 * PO always reflects reality without a second, separate "mark received" step that could drift
 * from what `/stock` actually shows.
 */
export async function receivePurchaseOrderItems(
  ctx: TenantContext,
  poId: string,
  input: ReceivePurchaseOrderItemsInput,
  createdBy: string,
): Promise<PurchaseOrderWithItems> {
  const po = await getPurchaseOrder(ctx, poId);
  if (po.status === "received" || po.status === "cancelled") {
    throw new PurchaseOrderNotEditableError(poId, po.status);
  }

  const entries = Object.entries(input.receipts).filter(([, qty]) => qty > 0);
  if (entries.length === 0) throw new Error("At least one line must have a received quantity greater than zero");

  for (const [poItemId, quantity] of entries) {
    const poItem = po.items.find((i) => i.id === poItemId);
    if (!poItem) throw new NotFoundError(`Purchase order item ${poItemId} not found on this order`);
    const remaining = Number(poItem.quantityOrdered) - Number(poItem.quantityReceived);
    if (quantity > remaining) {
      throw new Error(`Cannot receive ${quantity} of "${poItem.inventoryItem.name}" — only ${remaining} still expected`);
    }

    await receiveStock(
      ctx,
      poItem.inventoryItemId,
      { quantity, lotNumber: input.lotNumber ?? `${po.orderNumber}`, expiresAt: input.expiresAt, supplierId: po.supplierId },
      createdBy,
    );
    await prisma.purchaseOrderItem.update({
      where: { id: poItemId },
      data: { quantityReceived: { increment: quantity } },
    });
  }

  const refreshed = await getPurchaseOrder(ctx, poId);
  const allReceived = refreshed.items.every((i) => Number(i.quantityReceived) >= Number(i.quantityOrdered));
  const anyReceived = refreshed.items.some((i) => Number(i.quantityReceived) > 0);
  const nextStatus: PurchaseOrderStatus = allReceived ? "received" : anyReceived ? "partially_received" : refreshed.status;

  if (nextStatus !== refreshed.status) {
    await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: nextStatus } });
  }

  return getPurchaseOrder(ctx, poId);
}
