import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import {
  createExpense,
  createRecurringExpense,
  generateExpenseFromRecurring,
  listExpenses,
  listRecurringExpenses,
  setRecurringExpenseActive,
} from "./expenses";

/** ÉTAPE 16 : les charges (ponctuelles et récurrentes) restent strictement scopées par clinique,
 * et "générer maintenant" une charge récurrente doit produire une vraie Expense tracée en avançant
 * honnêtement la prochaine échéance — jamais une simple case cochée sans trace. */
describe("expenses repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Expenses Test Org ${suffix}`, slug: `expenses-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Expenses Test Org B ${suffix}`, slug: `expenses-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({ data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" } });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;
  });

  afterAll(async () => {
    await prisma.expense.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.recurringExpense.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("creates a one-off expense and lists it", async () => {
    const expense = await createExpense(ctx, { category: "consumables", amount: 120.5, date: new Date("2026-03-01") }, "dr-meyer");
    const list = await listExpenses(ctx);
    expect(list.some((e) => e.id === expense.id)).toBe(true);
  });

  it("filters expenses by date range and category", async () => {
    await createExpense(ctx, { category: "rent", amount: 2000, date: new Date("2026-01-05") }, "dr-meyer");
    await createExpense(ctx, { category: "rent", amount: 2000, date: new Date("2026-02-05") }, "dr-meyer");
    await createExpense(ctx, { category: "software", amount: 89, date: new Date("2026-02-10") }, "dr-meyer");

    const januaryOnly = await listExpenses(ctx, { from: new Date("2026-01-01"), to: new Date("2026-01-31") });
    expect(januaryOnly.every((e) => e.date >= new Date("2026-01-01") && e.date <= new Date("2026-01-31"))).toBe(true);

    const rentOnly = await listExpenses(ctx, { category: "rent" });
    expect(rentOnly.every((e) => e.category === "rent")).toBe(true);
    expect(rentOnly.length).toBeGreaterThanOrEqual(2);
  });

  it("creates a recurring expense template", async () => {
    const template = await createRecurringExpense(
      ctx,
      { category: "software", label: "Licence DentalOS", amount: 199, intervalUnit: "monthly", nextRunAt: new Date("2026-04-01") },
      "dr-meyer",
    );
    expect(template.isActive).toBe(true);

    const list = await listRecurringExpenses(ctx);
    expect(list.some((r) => r.id === template.id)).toBe(true);
  });

  it("generates a real expense from a recurring template and advances nextRunAt", async () => {
    const template = await createRecurringExpense(
      ctx,
      { category: "insurance", label: "RC professionnelle", amount: 450, intervalUnit: "quarterly", nextRunAt: new Date("2026-04-01") },
      "dr-meyer",
    );

    const expense = await generateExpenseFromRecurring(ctx, template.id, "dr-meyer");
    expect(Number(expense.amount)).toBe(450);
    expect(expense.recurringExpenseId).toBe(template.id);

    const refreshed = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: template.id } });
    expect(refreshed.nextRunAt.getTime()).toBeGreaterThan(new Date("2026-04-01").getTime());
    expect(refreshed.nextRunAt.getMonth()).toBe(6); // avril (mois 3) + 3 mois = juillet (mois 6)
  });

  it("deactivates and reactivates a recurring expense", async () => {
    const template = await createRecurringExpense(
      ctx,
      { category: "telecom", label: "Internet", amount: 80, intervalUnit: "monthly", nextRunAt: new Date("2026-05-01") },
      "dr-meyer",
    );
    const deactivated = await setRecurringExpenseActive(ctx, template.id, false);
    expect(deactivated.isActive).toBe(false);
    const reactivated = await setRecurringExpenseActive(ctx, template.id, true);
    expect(reactivated.isActive).toBe(true);
  });

  it("never lists or generates from another organization's recurring expense", async () => {
    const foreignTemplate = await createRecurringExpense(
      otherCtx,
      { category: "other", label: "Foreign", amount: 1, intervalUnit: "monthly", nextRunAt: new Date() },
      "seed",
    );

    const list = await listRecurringExpenses(ctx);
    expect(list.some((r) => r.id === foreignTemplate.id)).toBe(false);
    await expect(generateExpenseFromRecurring(ctx, foreignTemplate.id, "dr-meyer")).rejects.toThrow(/not found/i);
  });
});
