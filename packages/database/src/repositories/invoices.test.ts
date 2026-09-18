import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { addInvoiceItem, createInvoiceFromQuote, InvoiceNotEditableError, validateInvoice } from "./invoices";
import { createPatient } from "./patients";
import { createQuoteFromPlanOption } from "./quotes";
import { createTreatmentPlan } from "./treatment-plans";

describe("invoices", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let practitionerId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Invoices Test Org ${suffix}`, slug: `invoices-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Inv-${suffix}` },
    });
    practitionerId = practitioner.id;
  });

  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.practitioner.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  async function makeQuote(lastName: string) {
    const patient = await createPatient(ctx, { firstName: "Test", lastName }, "seed");
    const plan = await createTreatmentPlan(
      ctx,
      patient.id,
      { practitionerId, optionLabel: "Option A", items: [{ description: "Détartrage", unitPrice: 120, quantity: 1 }] },
      "dr-meyer",
    );
    return createQuoteFromPlanOption(ctx, plan.options[0]!.id, undefined, "dr-meyer");
  }

  it("copies the quote's lines and totals into a new draft invoice", async () => {
    const quote = await makeQuote(`Draft-${suffix}`);
    const invoice = await createInvoiceFromQuote(ctx, quote.id, undefined, "dr-meyer");

    expect(invoice.status).toBe("draft");
    expect(invoice.total.toString()).toBe(quote.total.toString());
    expect(invoice.balance.toString()).toBe(quote.total.toString());
    expect(invoice.items).toHaveLength(1);
  });

  it("recomputes totals when an item is added to a draft invoice", async () => {
    const quote = await makeQuote(`AddItem-${suffix}`);
    const invoice = await createInvoiceFromQuote(ctx, quote.id, undefined, "dr-meyer");

    const updated = await addInvoiceItem(ctx, invoice.id, { description: "Radio", quantity: 1, unitPrice: 45 });
    expect(updated.total.toString()).toBe((Number(quote.total) + 45).toString());
    expect(updated.items).toHaveLength(2);
  });

  it("refuses to add an item to a validated invoice — never editable after issuance", async () => {
    const quote = await makeQuote(`Immutable-${suffix}`);
    const invoice = await createInvoiceFromQuote(ctx, quote.id, undefined, "dr-meyer");
    await validateInvoice(ctx, invoice.id, "dr-meyer");

    await expect(
      addInvoiceItem(ctx, invoice.id, { description: "Late addition", quantity: 1, unitPrice: 10 }),
    ).rejects.toThrow(InvoiceNotEditableError);
  });

  it("refuses to validate an invoice twice", async () => {
    const quote = await makeQuote(`DoubleValidate-${suffix}`);
    const invoice = await createInvoiceFromQuote(ctx, quote.id, undefined, "dr-meyer");
    await validateInvoice(ctx, invoice.id, "dr-meyer");

    await expect(validateInvoice(ctx, invoice.id, "dr-meyer")).rejects.toThrow(InvoiceNotEditableError);
  });

  it("never assigns the same invoice number twice under concurrent creation", async () => {
    const quotes = await Promise.all(
      Array.from({ length: 4 }, (_, i) => makeQuote(`Concurrent-${i}-${suffix}`)),
    );
    const invoices = await Promise.all(
      quotes.map((q) => createInvoiceFromQuote(ctx, q.id, undefined, "dr-meyer")),
    );
    const numbers = invoices.map((inv) => inv.invoiceNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
