import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createInvoiceFromQuote } from "./invoices";
import { createPatient } from "./patients";
import { recordPayment } from "./payments";
import { createQuoteFromPlanOption } from "./quotes";
import { createTreatmentPlan } from "./treatment-plans";

describe("payments", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let practitionerId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Payments Test Org ${suffix}`, slug: `payments-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Pay-${suffix}` },
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
    const invoice = await createInvoiceFromQuote(ctx, quote.id, undefined, "dr-meyer");
    return { patient, invoice };
  }

  it("marks an invoice partially_paid when the payment is less than the balance", async () => {
    const { patient, invoice } = await makeInvoice(`Partial-${suffix}`, 200);

    await recordPayment(
      ctx,
      { patientId: patient.id, amount: 80, method: "twint", allocations: [{ invoiceId: invoice.id, amount: 80 }] },
      "dr-meyer",
    );

    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("partially_paid");
    expect(updated.amountPaid.toString()).toBe("80");
    expect(updated.balance.toString()).toBe("120");
  });

  it("marks an invoice paid once the full balance is covered, possibly across two payments", async () => {
    const { patient, invoice } = await makeInvoice(`Full-${suffix}`, 150);

    await recordPayment(
      ctx,
      { patientId: patient.id, amount: 100, method: "cash", allocations: [{ invoiceId: invoice.id, amount: 100 }] },
      "dr-meyer",
    );
    await recordPayment(
      ctx,
      { patientId: patient.id, amount: 50, method: "cash", allocations: [{ invoiceId: invoice.id, amount: 50 }] },
      "dr-meyer",
    );

    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("paid");
    expect(updated.balance.toString()).toBe("0");
  });

  it("splits one payment across two invoices correctly", async () => {
    const { patient: patientA, invoice: invoiceA } = await makeInvoice(`SplitA-${suffix}`, 100);
    const { invoice: invoiceB } = await makeInvoice(`SplitB-${suffix}`, 60);

    await recordPayment(
      ctx,
      {
        patientId: patientA.id,
        amount: 130,
        method: "card",
        allocations: [
          { invoiceId: invoiceA.id, amount: 100 },
          { invoiceId: invoiceB.id, amount: 30 },
        ],
      },
      "dr-meyer",
    );

    const updatedA = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceA.id } });
    const updatedB = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceB.id } });
    expect(updatedA.status).toBe("paid");
    expect(updatedB.status).toBe("partially_paid");
    expect(updatedB.balance.toString()).toBe("30");
  });

  it("rejects allocations that don't sum to the payment amount", async () => {
    const { patient, invoice } = await makeInvoice(`Mismatch-${suffix}`, 100);
    await expect(
      recordPayment(
        ctx,
        { patientId: patient.id, amount: 50, method: "twint", allocations: [{ invoiceId: invoice.id, amount: 40 }] },
        "dr-meyer",
      ),
    ).rejects.toThrow(/add up/i);
  });

  it("rejects an allocation larger than the invoice's balance", async () => {
    const { patient, invoice } = await makeInvoice(`Overpay-${suffix}`, 50);
    await expect(
      recordPayment(
        ctx,
        { patientId: patient.id, amount: 999, method: "twint", allocations: [{ invoiceId: invoice.id, amount: 999 }] },
        "dr-meyer",
      ),
    ).rejects.toThrow(/exceeds/i);
  });
});
