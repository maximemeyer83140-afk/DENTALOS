import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { getTariffItem, listActiveTariffItems } from "./tariff";

describe("tariff catalog", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let activeItemId = "";
  let inactiveVersionItemId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Tariff Test Org ${suffix}`, slug: `tariff-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const catalog = await prisma.tariffCatalog.create({
      data: { organizationId: org.id, name: "Test Catalog", system: "TEST" },
    });
    const activeVersion = await prisma.tariffVersion.create({
      data: { tariffCatalogId: catalog.id, versionLabel: "v1", validFrom: new Date("2026-01-01"), isActive: true },
    });
    const inactiveVersion = await prisma.tariffVersion.create({
      data: { tariffCatalogId: catalog.id, versionLabel: "v0", validFrom: new Date("2025-01-01"), isActive: false },
    });

    const activeItem = await prisma.tariffItem.create({
      data: { tariffVersionId: activeVersion.id, code: "ANE-01", description: "Anesthésie locale", category: "Anesthésie", points: 14, pointValue: 1 },
    });
    activeItemId = activeItem.id;

    const inactiveItem = await prisma.tariffItem.create({
      data: { tariffVersionId: inactiveVersion.id, code: "OLD-01", description: "Ancien acte", category: "Ancien", points: 5, pointValue: 1 },
    });
    inactiveVersionItemId = inactiveItem.id;
  });

  afterAll(async () => {
    await prisma.tariffItem.deleteMany({ where: { tariffVersion: { catalog: { organizationId: ctx.organizationId } } } });
    await prisma.tariffVersion.deleteMany({ where: { catalog: { organizationId: ctx.organizationId } } });
    await prisma.tariffCatalog.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  it("only lists items from the active tariff version", async () => {
    const items = await listActiveTariffItems(ctx);
    const codes = items.map((item) => item.code);
    expect(codes).toContain("ANE-01");
    expect(codes).not.toContain("OLD-01");
  });

  it("finds a tariff item by id within the tenant", async () => {
    const item = await getTariffItem(ctx, activeItemId);
    expect(item.code).toBe("ANE-01");
  });

  it("still resolves an item on an inactive version by id (history stays readable)", async () => {
    const item = await getTariffItem(ctx, inactiveVersionItemId);
    expect(item.code).toBe("OLD-01");
  });

  it("throws for a tariff item belonging to another organization", async () => {
    const otherOrg = await prisma.organization.create({
      data: { name: `Other Org ${suffix}`, slug: `other-org-${suffix}` },
    });
    await expect(getTariffItem({ organizationId: otherOrg.id, clinicId: "irrelevant" }, activeItemId)).rejects.toThrow(
      /not found/,
    );
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
