import type { InventoryItem, InventoryLot, InventoryMovement, InventoryItemCategory, Supplier } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export class InsufficientStockError extends Error {
  constructor(itemId: string, available: number, requested: number) {
    super(`Insufficient stock for item ${itemId}: ${available} available, ${requested} requested`);
    this.name = "InsufficientStockError";
  }
}

export interface CreateSupplierInput {
  name: string;
  addressLine1?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  contactName?: string | undefined;
  paymentTerms?: string | undefined;
  averageLeadTimeDays?: number | undefined;
  notes?: string | undefined;
}

/** Suppliers belong to the organization, not a single clinic — the same supplier (ex. un
 * dépositaire dentaire) livre en général plusieurs cabinets d'un même groupe. */
export async function listSuppliers(ctx: TenantContext): Promise<Supplier[]> {
  return prisma.supplier.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { name: "asc" },
  });
}

export async function createSupplier(ctx: TenantContext, input: CreateSupplierInput): Promise<Supplier> {
  return prisma.supplier.create({ data: { organizationId: ctx.organizationId, ...input } });
}

export interface CreateInventoryItemInput {
  sku: string;
  name: string;
  category: InventoryItemCategory;
  supplierId?: string | undefined;
  supplierRef?: string | undefined;
  unit?: string | undefined;
  costPrice: number;
  salePrice?: number | undefined;
  reorderThreshold?: number | undefined;
  locationLabel?: string | undefined;
}

export type UpdateInventoryItemInput = Partial<Omit<CreateInventoryItemInput, "sku" | "category">>;

export type InventoryItemWithStock = InventoryItem & { currentStock: number; isLowStock: boolean; supplierName: string | null };

async function currentStockFor(itemId: string): Promise<number> {
  const result = await prisma.inventoryMovement.aggregate({
    where: { inventoryItemId: itemId },
    _sum: { quantity: true },
  });
  return Number(result._sum.quantity ?? 0);
}

/** The stock dashboard's listing — every item with its live balance computed from the movement
 * ledger (see `recordMovement` below for why that ledger, not `InventoryLot.quantity`, is the
 * source of truth for "how much is on the shelf right now"). */
export async function listInventoryItems(ctx: TenantContext): Promise<InventoryItemWithStock[]> {
  const items = await prisma.inventoryItem.findMany({
    where: { organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: { supplier: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    items.map(async (item) => {
      const currentStock = await currentStockFor(item.id);
      return {
        ...item,
        currentStock,
        isLowStock: currentStock <= item.reorderThreshold,
        supplierName: item.supplier?.name ?? null,
      };
    }),
  );
}

export async function getInventoryItem(ctx: TenantContext, itemId: string): Promise<InventoryItemWithStock> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: { supplier: { select: { name: true } } },
  });
  if (!item) throw new NotFoundError(`Inventory item ${itemId} not found`);
  const currentStock = await currentStockFor(item.id);
  return { ...item, currentStock, isLowStock: currentStock <= item.reorderThreshold, supplierName: item.supplier?.name ?? null };
}

export async function createInventoryItem(ctx: TenantContext, input: CreateInventoryItemInput): Promise<InventoryItem> {
  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, organizationId: ctx.organizationId } });
    if (!supplier) throw new NotFoundError(`Supplier ${input.supplierId} not found`);
  }
  return prisma.inventoryItem.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      sku: input.sku,
      name: input.name,
      category: input.category,
      supplierId: input.supplierId,
      supplierRef: input.supplierRef,
      unit: input.unit ?? "piece",
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      reorderThreshold: input.reorderThreshold ?? 0,
      locationLabel: input.locationLabel,
    },
  });
}

export async function updateInventoryItem(
  ctx: TenantContext,
  itemId: string,
  input: UpdateInventoryItemInput,
): Promise<InventoryItem> {
  const result = await prisma.inventoryItem.updateMany({
    where: { id: itemId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: input,
  });
  if (result.count === 0) throw new NotFoundError(`Inventory item ${itemId} not found`);
  return prisma.inventoryItem.findFirstOrThrow({ where: { id: itemId } });
}

export interface ReceiveStockInput {
  quantity: number;
  lotNumber?: string | undefined;
  expiresAt?: Date | undefined;
  supplierId?: string | undefined;
}

/**
 * `InventoryLot` records what physically arrived (lot number, expiry, supplier) — a historical
 * batch record, never mutated afterwards. `InventoryMovement` is the append-only ledger that
 * actually drives the live stock balance (`currentStockFor`, a plain sum of every movement's
 * *signed* quantity for the item — receipts positive, consumption negative, adjustments whatever
 * sign the correction needs). Splitting the two avoids ever having to decide which lot a
 * consumption "came from" (FIFO, expiry-first, ...) just to answer "how much is left" — a real
 * simplification documented in PHASE_9.md, acceptable because this module tracks quantity, not a
 * full costing/valuation system.
 */
export async function receiveStock(
  ctx: TenantContext,
  itemId: string,
  input: ReceiveStockInput,
  createdBy: string,
): Promise<{ lot: InventoryLot; movement: InventoryMovement }> {
  if (input.quantity <= 0) throw new Error("Received quantity must be positive");

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
  if (!item) throw new NotFoundError(`Inventory item ${itemId} not found`);

  return prisma.$transaction(async (tx) => {
    const lot = await tx.inventoryLot.create({
      data: {
        inventoryItemId: itemId,
        lotNumber: input.lotNumber ?? `REC-${Date.now()}`,
        quantity: input.quantity,
        expiresAt: input.expiresAt,
        supplierId: input.supplierId,
      },
    });
    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryItemId: itemId,
        lotId: lot.id,
        type: "receipt",
        quantity: input.quantity,
        createdBy,
      },
    });
    return { lot, movement };
  });
}

export interface ConsumeStockInput {
  quantity: number;
  reason?: string | undefined;
  relatedPatientId?: string | undefined;
  relatedTreatmentId?: string | undefined;
}

export async function consumeStock(
  ctx: TenantContext,
  itemId: string,
  input: ConsumeStockInput,
  createdBy: string,
): Promise<InventoryMovement> {
  if (input.quantity <= 0) throw new Error("Consumed quantity must be positive");

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
  if (!item) throw new NotFoundError(`Inventory item ${itemId} not found`);

  const available = await currentStockFor(itemId);
  if (available < input.quantity) throw new InsufficientStockError(itemId, available, input.quantity);

  return prisma.inventoryMovement.create({
    data: {
      inventoryItemId: itemId,
      type: "consumption",
      quantity: -input.quantity,
      reason: input.reason,
      relatedPatientId: input.relatedPatientId,
      relatedTreatmentId: input.relatedTreatmentId,
      createdBy,
    },
  });
}

export interface AdjustStockInput {
  /** Positive corrects stock upward (ex. inventaire physique en trouve plus), negative vers le
   * bas (perte, casse, péremption jetée). */
  delta: number;
  reason: string;
}

export async function adjustStock(
  ctx: TenantContext,
  itemId: string,
  input: AdjustStockInput,
  createdBy: string,
): Promise<InventoryMovement> {
  if (input.delta === 0) throw new Error("Adjustment delta cannot be zero");

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
  if (!item) throw new NotFoundError(`Inventory item ${itemId} not found`);

  if (input.delta < 0) {
    const available = await currentStockFor(itemId);
    if (available < -input.delta) throw new InsufficientStockError(itemId, available, -input.delta);
  }

  return prisma.inventoryMovement.create({
    data: {
      inventoryItemId: itemId,
      type: "adjustment",
      quantity: input.delta,
      reason: input.reason,
      createdBy,
    },
  });
}

export async function listMovementsForItem(ctx: TenantContext, itemId: string): Promise<InventoryMovement[]> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!item) throw new NotFoundError(`Inventory item ${itemId} not found`);

  return prisma.inventoryMovement.findMany({
    where: { inventoryItemId: itemId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listLotsForItem(ctx: TenantContext, itemId: string): Promise<InventoryLot[]> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!item) throw new NotFoundError(`Inventory item ${itemId} not found`);

  return prisma.inventoryLot.findMany({
    where: { inventoryItemId: itemId },
    orderBy: { receivedAt: "desc" },
  });
}
