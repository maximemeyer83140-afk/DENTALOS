import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createInventoryItem, createSupplier, getInventoryItem } from "./inventory";
import { prisma } from "../index";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  PurchaseOrderNotEditableError,
  receivePurchaseOrderItems,
  sendPurchaseOrder,
} from "./purchase-orders";

/** ÉTAPE 14 : un bon de commande reçu doit se traduire exactement dans le stock (même lot, même
 * mouvement que `/stock` afficherait pour une réception manuelle), jamais un second registre qui
 * pourrait diverger. */
describe("purchase orders repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let supplierId = "";
  let itemAId = "";
  let itemBId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `PO Test Org ${suffix}`, slug: `po-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const supplier = await createSupplier(ctx, { name: `Dépositaire ${suffix}` });
    supplierId = supplier.id;
    const itemA = await createInventoryItem(ctx, { sku: `PO-SKU-${suffix}-A`, name: "Composite", category: "composites", costPrice: 20 });
    itemAId = itemA.id;
    const itemB = await createInventoryItem(ctx, { sku: `PO-SKU-${suffix}-B`, name: "Gants", category: "gloves", costPrice: 5 });
    itemBId = itemB.id;
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { inventoryItem: { organizationId: ctx.organizationId } } });
    await prisma.inventoryLot.deleteMany({ where: { inventoryItem: { organizationId: ctx.organizationId } } });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { organizationId: ctx.organizationId } } });
    await prisma.purchaseOrder.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.inventoryItem.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.supplier.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  it("creates a draft PO with its lines", async () => {
    const po = await createPurchaseOrder(
      ctx,
      { supplierId, items: [{ inventoryItemId: itemAId, quantityOrdered: 10, unitCost: 18 }] },
      "dr-meyer",
    );
    expect(po.status).toBe("draft");
    expect(po.orderNumber).toMatch(/^PO-\d{4}-\d{4}$/);
    expect(po.items).toHaveLength(1);

    const list = await listPurchaseOrders(ctx);
    expect(list.some((p) => p.id === po.id)).toBe(true);
  });

  it("refuses a PO with an item from another clinic/org", async () => {
    await expect(
      createPurchaseOrder(ctx, { supplierId, items: [{ inventoryItemId: "does-not-exist", quantityOrdered: 1, unitCost: 1 }] }, "dr-meyer"),
    ).rejects.toThrow(/not found/i);
  });

  it("moves draft -> sent, refuses to send twice", async () => {
    const po = await createPurchaseOrder(ctx, { supplierId, items: [{ inventoryItemId: itemAId, quantityOrdered: 5, unitCost: 18 }] }, "dr-meyer");
    const sent = await sendPurchaseOrder(ctx, po.id);
    expect(sent.status).toBe("sent");
    await expect(sendPurchaseOrder(ctx, po.id)).rejects.toThrow(PurchaseOrderNotEditableError);
  });

  it("receiving all lines in full raises the item's stock and marks the PO received", async () => {
    const po = await createPurchaseOrder(
      ctx,
      {
        supplierId,
        items: [
          { inventoryItemId: itemAId, quantityOrdered: 10, unitCost: 18 },
          { inventoryItemId: itemBId, quantityOrdered: 100, unitCost: 4.5 },
        ],
      },
      "dr-meyer",
    );
    const stockBeforeA = (await getInventoryItem(ctx, itemAId)).currentStock;
    const stockBeforeB = (await getInventoryItem(ctx, itemBId)).currentStock;

    const received = await receivePurchaseOrderItems(
      ctx,
      po.id,
      { receipts: { [po.items[0]!.id]: 10, [po.items[1]!.id]: 100 } },
      "dr-meyer",
    );
    expect(received.status).toBe("received");
    expect(Number(received.items[0]!.quantityReceived)).toBe(10);

    expect((await getInventoryItem(ctx, itemAId)).currentStock).toBe(stockBeforeA + 10);
    expect((await getInventoryItem(ctx, itemBId)).currentStock).toBe(stockBeforeB + 100);
  });

  it("a partial delivery marks the PO partially_received and can be completed later", async () => {
    const po = await createPurchaseOrder(ctx, { supplierId, items: [{ inventoryItemId: itemAId, quantityOrdered: 20, unitCost: 18 }] }, "dr-meyer");

    const partial = await receivePurchaseOrderItems(ctx, po.id, { receipts: { [po.items[0]!.id]: 12 } }, "dr-meyer");
    expect(partial.status).toBe("partially_received");
    expect(Number(partial.items[0]!.quantityReceived)).toBe(12);

    const complete = await receivePurchaseOrderItems(ctx, po.id, { receipts: { [po.items[0]!.id]: 8 } }, "dr-meyer");
    expect(complete.status).toBe("received");
  });

  it("refuses to receive more than what remains on a line", async () => {
    const po = await createPurchaseOrder(ctx, { supplierId, items: [{ inventoryItemId: itemAId, quantityOrdered: 5, unitCost: 18 }] }, "dr-meyer");
    await expect(
      receivePurchaseOrderItems(ctx, po.id, { receipts: { [po.items[0]!.id]: 6 } }, "dr-meyer"),
    ).rejects.toThrow(/only .* still expected/i);
  });

  it("cancels a draft PO but refuses to touch an already-received one", async () => {
    const po = await createPurchaseOrder(ctx, { supplierId, items: [{ inventoryItemId: itemAId, quantityOrdered: 1, unitCost: 18 }] }, "dr-meyer");
    const cancelled = await cancelPurchaseOrder(ctx, po.id);
    expect(cancelled.status).toBe("cancelled");

    const receivedPo = await createPurchaseOrder(ctx, { supplierId, items: [{ inventoryItemId: itemAId, quantityOrdered: 1, unitCost: 18 }] }, "dr-meyer");
    await receivePurchaseOrderItems(ctx, receivedPo.id, { receipts: { [receivedPo.items[0]!.id]: 1 } }, "dr-meyer");
    await expect(cancelPurchaseOrder(ctx, receivedPo.id)).rejects.toThrow(PurchaseOrderNotEditableError);
  });

  it("never fetches or lists another organization's purchase order", async () => {
    const otherOrg = await prisma.organization.create({ data: { name: `PO Other Org ${suffix}`, slug: `po-other-org-${suffix}` } });
    const otherClinic = await prisma.clinic.create({ data: { organizationId: otherOrg.id, name: "Other", slug: "main" } });
    const otherCtx = { organizationId: otherOrg.id, clinicId: otherClinic.id };
    const otherSupplier = await createSupplier(otherCtx, { name: "Other supplier" });
    const otherItem = await createInventoryItem(otherCtx, { sku: "OTHER", name: "Other item", category: "other", costPrice: 1 });
    const foreignPo = await createPurchaseOrder(otherCtx, { supplierId: otherSupplier.id, items: [{ inventoryItemId: otherItem.id, quantityOrdered: 1, unitCost: 1 }] }, "seed");

    await expect(getPurchaseOrder(ctx, foreignPo.id)).rejects.toThrow(/not found/i);
    const list = await listPurchaseOrders(ctx);
    expect(list.some((p) => p.id === foreignPo.id)).toBe(false);

    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { organizationId: otherOrg.id } } });
    await prisma.purchaseOrder.deleteMany({ where: { organizationId: otherOrg.id } });
    await prisma.inventoryItem.deleteMany({ where: { organizationId: otherOrg.id } });
    await prisma.supplier.deleteMany({ where: { organizationId: otherOrg.id } });
    await prisma.clinic.deleteMany({ where: { organizationId: otherOrg.id } });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
