import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import {
  adjustStock,
  consumeStock,
  createInventoryItem,
  createSupplier,
  getInventoryItem,
  InsufficientStockError,
  listInventoryItems,
  listLotsForItem,
  listMovementsForItem,
  listSuppliers,
  receiveStock,
} from "./inventory";

/** ÉTAPE 13 : le solde de stock affiché doit toujours être la somme signée du grand livre des
 * mouvements — jamais une valeur qui dérive silencieusement d'un lot mis à jour à la main — et
 * rester strictement scopé par clinique/organisation. */
describe("inventory repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Inventory Test Org ${suffix}`, slug: `inventory-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Inventory Test Org B ${suffix}`, slug: `inventory-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({ data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" } });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { inventoryItem: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } } });
    await prisma.inventoryLot.deleteMany({ where: { inventoryItem: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } } });
    await prisma.inventoryItem.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.supplier.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("creates a supplier scoped to the organization", async () => {
    const supplier = await createSupplier(ctx, { name: `Dépositaire ${suffix}` });
    const list = await listSuppliers(ctx);
    expect(list.some((s) => s.id === supplier.id)).toBe(true);
  });

  it("creates an item with zero stock and no low-stock flag when threshold is zero", async () => {
    const item = await createInventoryItem(ctx, {
      sku: `SKU-${suffix}-A`,
      name: "Gants nitrile M",
      category: "gloves",
      costPrice: 8.5,
    });
    const fetched = await getInventoryItem(ctx, item.id);
    expect(fetched.currentStock).toBe(0);
    expect(fetched.isLowStock).toBe(true); // 0 <= threshold (0)
  });

  it("receives stock: creates a lot and a positive movement, raises the balance", async () => {
    const item = await createInventoryItem(ctx, {
      sku: `SKU-${suffix}-B`,
      name: "Composite A2",
      category: "composites",
      costPrice: 25,
      reorderThreshold: 5,
    });
    await receiveStock(ctx, item.id, { quantity: 10, lotNumber: "LOT-1" }, "dr-meyer");

    const fetched = await getInventoryItem(ctx, item.id);
    expect(fetched.currentStock).toBe(10);
    expect(fetched.isLowStock).toBe(false);

    const lots = await listLotsForItem(ctx, item.id);
    expect(lots).toHaveLength(1);
    expect(lots[0]!.lotNumber).toBe("LOT-1");
  });

  it("consumes stock and refuses to go below zero", async () => {
    const item = await createInventoryItem(ctx, {
      sku: `SKU-${suffix}-C`,
      name: "Anesthésie articaïne",
      category: "anesthetics",
      costPrice: 1.2,
    });
    await receiveStock(ctx, item.id, { quantity: 5 }, "dr-meyer");
    await consumeStock(ctx, item.id, { quantity: 3, reason: "Séance patient" }, "dr-meyer");

    const fetched = await getInventoryItem(ctx, item.id);
    expect(fetched.currentStock).toBe(2);

    await expect(consumeStock(ctx, item.id, { quantity: 10 }, "dr-meyer")).rejects.toThrow(InsufficientStockError);
    // Le solde ne doit pas avoir bougé après le refus.
    expect((await getInventoryItem(ctx, item.id)).currentStock).toBe(2);
  });

  it("adjusts stock up and down, refusing a downward adjustment beyond what's available", async () => {
    const item = await createInventoryItem(ctx, {
      sku: `SKU-${suffix}-D`,
      name: "Masques chirurgicaux",
      category: "masks",
      costPrice: 0.3,
    });
    await receiveStock(ctx, item.id, { quantity: 20 }, "dr-meyer");
    await adjustStock(ctx, item.id, { delta: -4, reason: "Casse" }, "dr-meyer");
    expect((await getInventoryItem(ctx, item.id)).currentStock).toBe(16);

    await adjustStock(ctx, item.id, { delta: 2, reason: "Inventaire physique" }, "dr-meyer");
    expect((await getInventoryItem(ctx, item.id)).currentStock).toBe(18);

    await expect(adjustStock(ctx, item.id, { delta: -100, reason: "x" }, "dr-meyer")).rejects.toThrow(InsufficientStockError);
  });

  it("lists movements newest first and flags low stock once at/under threshold", async () => {
    const item = await createInventoryItem(ctx, {
      sku: `SKU-${suffix}-E`,
      name: "Fraises diamant",
      category: "burs",
      costPrice: 4,
      reorderThreshold: 10,
    });
    await receiveStock(ctx, item.id, { quantity: 12 }, "dr-meyer");
    await consumeStock(ctx, item.id, { quantity: 3 }, "dr-meyer");

    const movements = await listMovementsForItem(ctx, item.id);
    expect(movements).toHaveLength(2);
    expect(movements[0]!.type).toBe("consumption");
    expect(Number(movements[0]!.quantity)).toBe(-3);

    const fetched = await getInventoryItem(ctx, item.id);
    expect(fetched.currentStock).toBe(9);
    expect(fetched.isLowStock).toBe(true);
  });

  it("never lists, fetches or writes another organization's item", async () => {
    const foreignItem = await createInventoryItem(otherCtx, {
      sku: `SKU-${suffix}-F`,
      name: "Foreign",
      category: "other",
      costPrice: 1,
    });

    const list = await listInventoryItems(ctx);
    expect(list.some((i) => i.id === foreignItem.id)).toBe(false);
    await expect(getInventoryItem(ctx, foreignItem.id)).rejects.toThrow(/not found/i);
    await expect(receiveStock(ctx, foreignItem.id, { quantity: 1 }, "seed")).rejects.toThrow(/not found/i);
  });
});
