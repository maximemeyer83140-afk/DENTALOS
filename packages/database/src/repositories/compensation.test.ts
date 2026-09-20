import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import {
  applyCompensationModel,
  CompensationStatementNotEditableError,
  generateCompensationStatement,
  getActiveCompensationRule,
  listCompensationRules,
  markStatementPaid,
  setCompensationRule,
  setStatementAdjustment,
  validateStatement,
} from "./compensation";
import { createPatient } from "./patients";

describe("applyCompensationModel — pure formulas", () => {
  const ca = { production: 10_000, billed: 9_000, collected: 8_000, creditNotes: 500 };

  it("salary ignores CA entirely and pays the fixed amount", () => {
    const result = applyCompensationModel("salary", null, { fixedAmount: 7500 }, ca);
    expect(result).toEqual({ baseAmount: 0, computedAmount: 7500 });
  });

  it("percentage_production applies the rate to production", () => {
    const result = applyCompensationModel("percentage_production", 0.4, null, ca);
    expect(result).toEqual({ baseAmount: 10_000, computedAmount: 4000 });
  });

  it("percentage_collected applies the rate to collected", () => {
    const result = applyCompensationModel("percentage_collected", 0.35, null, ca);
    expect(result).toEqual({ baseAmount: 8000, computedAmount: 2800 });
  });

  it("percentage_revenue applies the rate to billed minus credit notes", () => {
    const result = applyCompensationModel("percentage_revenue", 0.4, null, ca);
    expect(result).toEqual({ baseAmount: 8500, computedAmount: 3400 });
  });

  it("hybrid pays a fixed amount plus a rate on the base above a threshold", () => {
    const result = applyCompensationModel("hybrid", 0.5, { fixedAmount: 2000, thresholdAmount: 5000 }, ca);
    // base = 9000 - 500 = 8500 ; excess = 8500 - 5000 = 3500 ; 2000 + 3500*0.5 = 3750
    expect(result).toEqual({ baseAmount: 8500, computedAmount: 3750 });
  });

  it("hybrid never pays a negative excess when the base is under the threshold", () => {
    const result = applyCompensationModel("hybrid", 0.5, { fixedAmount: 2000, thresholdAmount: 50_000 }, ca);
    expect(result).toEqual({ baseAmount: 8500, computedAmount: 2000 });
  });
});

describe("compensation repository — rules and statements", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let practitionerId = "";
  let patientId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Comp Test Org ${suffix}`, slug: `comp-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Comp Test Org B ${suffix}`, slug: `comp-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({ data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" } });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Comp-${suffix}` },
    });
    practitionerId = practitioner.id;

    const patient = await createPatient(ctx, { firstName: "Comp", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;
  });

  afterAll(async () => {
    await prisma.compensationStatement.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.compensationRule.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.paymentAllocation.deleteMany({ where: { invoice: { organizationId: ctx.organizationId } } });
    await prisma.payment.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.creditNote.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: ctx.organizationId } } });
    await prisma.invoice.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.treatment.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.practitioner.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.patient.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("sets an initial rate with no end date", async () => {
    const rule = await setCompensationRule(ctx, practitionerId, { model: "percentage_revenue", rate: 0.4, validFrom: new Date("2026-01-01") }, "admin");
    expect(rule.validTo).toBeNull();

    const active = await getActiveCompensationRule(ctx, practitionerId, new Date("2026-01-15"));
    expect(active?.id).toBe(rule.id);
  });

  it("no rule is active before the first one's validFrom", async () => {
    const active = await getActiveCompensationRule(ctx, practitionerId, new Date("2025-01-01"));
    expect(active).toBeNull();
  });

  it("changing the rate closes the previous rule instead of editing it, preserving history", async () => {
    await setCompensationRule(ctx, practitionerId, { model: "percentage_revenue", rate: 0.4, validFrom: new Date("2026-03-01") }, "admin");
    const second = await setCompensationRule(ctx, practitionerId, { model: "percentage_revenue", rate: 0.45, validFrom: new Date("2026-06-01") }, "admin");

    const history = await listCompensationRules(ctx, practitionerId);
    const march = history.find((r) => r.validFrom.getTime() === new Date("2026-03-01").getTime());
    expect(march?.validTo?.getTime()).toBe(new Date("2026-06-01").getTime());
    expect(Number(march?.rate)).toBe(0.4);

    const activeInMay = await getActiveCompensationRule(ctx, practitionerId, new Date("2026-05-01"));
    expect(Number(activeInMay?.rate)).toBe(0.4);
    const activeInJuly = await getActiveCompensationRule(ctx, practitionerId, new Date("2026-07-01"));
    expect(activeInJuly?.id).toBe(second.id);
  });

  it("refuses a rate-based model without a rate", async () => {
    await expect(
      setCompensationRule(ctx, practitionerId, { model: "percentage_production", validFrom: new Date("2026-08-01") }, "admin"),
    ).rejects.toThrow(/rate is required/i);
  });

  it("refuses to set a rule for a practitioner outside the tenant", async () => {
    await expect(
      setCompensationRule(ctx, "does-not-exist", { model: "salary", config: { fixedAmount: 1000 }, validFrom: new Date() }, "admin"),
    ).rejects.toThrow(/not found/i);
  });

  it("refuses to backdate a new rate before the currently open rule's start date", async () => {
    // practitionerId's open rule at this point started 2026-06-01 (from the earlier test).
    await expect(
      setCompensationRule(ctx, practitionerId, { model: "percentage_revenue", rate: 0.6, validFrom: new Date("2026-01-01") }, "admin"),
    ).rejects.toThrow(/backdating would corrupt/i);
  });

  it("generates a real statement from actual invoices/payments/credit notes and refuses without an active rule", async () => {
    const statementPractitioner = await prisma.practitioner.create({
      data: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, firstName: "Dr", lastName: `Statement-${suffix}` },
    });
    await expect(
      generateCompensationStatement(ctx, statementPractitioner.id, new Date("2026-01-01"), new Date("2026-01-31"), "admin"),
    ).rejects.toThrow(/no compensation rule/i);

    await setCompensationRule(ctx, statementPractitioner.id, { model: "percentage_revenue", rate: 0.5, validFrom: new Date("2020-01-01") }, "admin");

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        patientId,
        practitionerId: statementPractitioner.id,
        invoiceNumber: `COMP-${suffix}`,
        status: "issued",
        issueDate: new Date("2027-01-10"),
        subtotal: 1000,
        total: 1000,
        balance: 800,
        amountPaid: 200,
      },
    });
    await prisma.creditNote.create({
      data: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, invoiceId: invoice.id, creditNoteNumber: `CN-${suffix}`, amount: 100, issueDate: new Date("2027-01-20") },
    });
    const payment = await prisma.payment.create({
      data: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, patientId, amount: 200, method: "card", status: "completed", paidAt: new Date("2027-01-15") },
    });
    await prisma.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: invoice.id, amount: 200 } });

    const statement = await generateCompensationStatement(ctx, practitionerId, new Date("2027-01-01"), new Date("2027-01-31"), "admin");
    expect(Number(statement.billed)).toBe(1000);
    expect(Number(statement.creditNotes)).toBe(100);
    expect(Number(statement.collected)).toBe(200);
    expect(Number(statement.baseAmount)).toBe(900); // 1000 - 100
    expect(Number(statement.rateApplied)).toBe(0.5);
    expect(Number(statement.computedAmount)).toBe(450);
    expect(Number(statement.finalAmount)).toBe(450);
    expect(statement.status).toBe("draft");
  });

  it("adjusts a draft statement's final amount but refuses once validated", async () => {
    const adjustmentPractitioner = await prisma.practitioner.create({
      data: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, firstName: "Dr", lastName: `Adjust-${suffix}` },
    });
    await setCompensationRule(ctx, adjustmentPractitioner.id, { model: "percentage_revenue", rate: 0.5, validFrom: new Date("2020-01-01") }, "admin");
    const statement = await generateCompensationStatement(ctx, adjustmentPractitioner.id, new Date("2027-02-01"), new Date("2027-02-28"), "admin");

    const adjusted = await setStatementAdjustment(ctx, statement.id, -50, "Erreur de facturation reprise");
    expect(Number(adjusted.finalAmount)).toBe(Number(statement.computedAmount) - 50);

    const validated = await validateStatement(ctx, statement.id);
    expect(validated.status).toBe("validated");
    await expect(setStatementAdjustment(ctx, statement.id, 10, undefined)).rejects.toThrow(CompensationStatementNotEditableError);

    const paid = await markStatementPaid(ctx, statement.id);
    expect(paid.status).toBe("paid");
    await expect(validateStatement(ctx, statement.id)).rejects.toThrow(CompensationStatementNotEditableError);
  });

  it("never uses another organization's practitioner", async () => {
    const otherPractitioner = await prisma.practitioner.create({
      data: { organizationId: otherCtx.organizationId, clinicId: otherCtx.clinicId, firstName: "Dr", lastName: "Foreign" },
    });
    await expect(
      setCompensationRule(ctx, otherPractitioner.id, { model: "salary", config: { fixedAmount: 1 }, validFrom: new Date() }, "admin"),
    ).rejects.toThrow(/not found/i);
  });
});
