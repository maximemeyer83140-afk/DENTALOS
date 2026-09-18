import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createCreditNote } from "./credit-notes";
import { createInvoiceFromQuote, validateInvoice } from "./invoices";
import { createPatient } from "./patients";
import { createQuoteFromPlanOption } from "./quotes";
import { createTreatmentPlan } from "./treatment-plans";

describe("credit notes", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let practitionerId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Credit Notes Test Org ${suffix}`, slug: `credit-notes-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Credit-${suffix}` },
    });
    practitionerId = practitioner.id;
  });

  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.practitioner.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  async function makeInvoice(lastName: string, price: number) {
    const patient = await createPatient(ctx, { firstName: "Test", lastName }, "seed");
    const plan = await createTreatmentPlan(
      ctx,
      patient.id,
      { practitionerId, optionLabel: "Option A", items: [{ description: "Soin", unitPrice: price, quantity: 1 }] },
      "dr-meyer",
    );
    const quote = await createQuoteFromPlanOption(ctx, plan.options[0]!.id, undefined, "dr-meyer");
    return createInvoiceFromQuote(ctx, quote.id, undefined, "dr-meyer");
  }

  it("refuses to credit a draft invoice", async () => {
    const invoice = await makeInvoice(`Draft-${suffix}`, 100);
    await expect(createCreditNote(ctx, invoice.id, 20, "test", "dr-meyer")).rejects.toThrow(/status "draft"/);
  });

  it("reduces the balance and moves a fully-credited invoice to credited", async () => {
    const invoice = await makeInvoice(`Full-${suffix}`, 100);
    await validateInvoice(ctx, invoice.id, "dr-meyer");

    await createCreditNote(ctx, invoice.id, 100, "Erreur de facturation", "dr-meyer");

    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.balance.toString()).toBe("0");
    expect(updated.status).toBe("credited");
  });

  it("refuses a credit note larger than the outstanding balance", async () => {
    const invoice = await makeInvoice(`TooBig-${suffix}`, 50);
    await validateInvoice(ctx, invoice.id, "dr-meyer");

    await expect(createCreditNote(ctx, invoice.id, 999, "test", "dr-meyer")).rejects.toThrow(/exceeds/i);
  });
});
