import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createQuoteFromPlanOption, updateQuoteStatus } from "./quotes";
import { createPatient } from "./patients";
import { createTreatmentPlan } from "./treatment-plans";

describe("quotes", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let practitionerId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Quotes Test Org ${suffix}`, slug: `quotes-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Quote-${suffix}` },
    });
    practitionerId = practitioner.id;
  });

  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.practitioner.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  async function makePlanOption(lastName: string) {
    const patient = await createPatient(ctx, { firstName: "Test", lastName }, "seed");
    const plan = await createTreatmentPlan(
      ctx,
      patient.id,
      {
        practitionerId,
        optionLabel: "Option A",
        items: [
          { description: "Implant", unitPrice: 2200, quantity: 1 },
          { description: "Couronne céramique", unitPrice: 1450, quantity: 1 },
        ],
      },
      "dr-meyer",
    );
    return plan.options[0]!.id;
  }

  it("computes the quote total as the sum of its lines", async () => {
    const optionId = await makePlanOption(`Total-${suffix}`);
    const quote = await createQuoteFromPlanOption(ctx, optionId, undefined, "dr-meyer");

    expect(quote.subtotal.toString()).toBe("3650");
    expect(quote.total.toString()).toBe("3650");
    expect(quote.items).toHaveLength(2);
  });

  it("never assigns the same quote number twice under concurrent creation", async () => {
    const optionIds = await Promise.all(
      Array.from({ length: 4 }, (_, i) => makePlanOption(`Concurrent-${i}-${suffix}`)),
    );
    const quotes = await Promise.all(optionIds.map((id) => createQuoteFromPlanOption(ctx, id, undefined, "dr-meyer")));
    const numbers = quotes.map((q) => q.quoteNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("includes each quote's lines, traced back to the plan item they came from", async () => {
    const optionId = await makePlanOption(`Items-${suffix}`);
    const quote = await createQuoteFromPlanOption(ctx, optionId, undefined, "dr-meyer");
    const option = await prisma.treatmentPlanOption.findUnique({ where: { id: optionId }, include: { items: true } });

    expect(quote.items.every((item) => item.treatmentPlanItemId !== null)).toBe(true);
    expect(quote.items.map((i) => i.treatmentPlanItemId).sort()).toEqual(option!.items.map((i) => i.id).sort());
  });

  it("ÉTAPE 7 : accepting a quote moves its still-planned plan items to accepted", async () => {
    const optionId = await makePlanOption(`Accept-${suffix}`);
    const quote = await createQuoteFromPlanOption(ctx, optionId, undefined, "dr-meyer");

    await updateQuoteStatus(ctx, quote.id, "accepted");

    const items = await prisma.treatmentPlanItem.findMany({ where: { treatmentPlanOptionId: optionId } });
    expect(items.every((i) => i.status === "accepted")).toBe(true);
  });

  it("ÉTAPE 7 : rejecting a quote moves its still-planned plan items to rejected", async () => {
    const optionId = await makePlanOption(`Reject-${suffix}`);
    const quote = await createQuoteFromPlanOption(ctx, optionId, undefined, "dr-meyer");

    await updateQuoteStatus(ctx, quote.id, "rejected");

    const items = await prisma.treatmentPlanItem.findMany({ where: { treatmentPlanOptionId: optionId } });
    expect(items.every((i) => i.status === "rejected")).toBe(true);
  });

  it("ÉTAPE 7 : a partially_accepted quote never cascades a status onto its plan items", async () => {
    const optionId = await makePlanOption(`Partial-${suffix}`);
    const quote = await createQuoteFromPlanOption(ctx, optionId, undefined, "dr-meyer");

    await updateQuoteStatus(ctx, quote.id, "partially_accepted");

    const items = await prisma.treatmentPlanItem.findMany({ where: { treatmentPlanOptionId: optionId } });
    expect(items.every((i) => i.status === "planned")).toBe(true);
  });

  it("refuses to quote a treatment plan option with no items", async () => {
    const patient = await createPatient(ctx, { firstName: "Empty", lastName: `Plan-${suffix}` }, "seed");
    const plan = await prisma.treatmentPlan.create({
      data: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        patientId: patient.id,
        practitionerId,
        options: { create: [{ label: "Option A" }] },
      },
      include: { options: true },
    });

    await expect(
      createQuoteFromPlanOption(ctx, plan.options[0]!.id, undefined, "dr-meyer"),
    ).rejects.toThrow(/no items/i);
  });
});
