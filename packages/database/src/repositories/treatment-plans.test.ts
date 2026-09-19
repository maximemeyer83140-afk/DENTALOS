import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createInvoiceFromQuote } from "./invoices";
import { createPatient } from "./patients";
import { createQuoteFromPlanOption } from "./quotes";
import {
  createTreatmentPlan,
  listSoinsForPatient,
  updateTreatmentPlanItemStatus,
} from "./treatment-plans";

/**
 * ÉTAPE 6 : un acte marqué "réalisé" doit rester traçable jusqu'à la facture puis au paiement —
 * ces tests suivent la même ligne de plan de traitement du bout à l'autre de la chaîne
 * (plan → Treatment → devis → facture → payée) et vérifient que `listSoinsForPatient` reflète
 * chaque étape sans jamais avoir été informé "à la main" du changement.
 */
describe("treatment plan items — soin traceability", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let practitionerId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Treatment Status Test Org ${suffix}`, slug: `treatment-status-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Soin-${suffix}` },
    });
    practitionerId = practitioner.id;
  });

  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.practitioner.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  it("creating a plan item directly as completed ('Traitement' mode) creates its Treatment record", async () => {
    const patient = await createPatient(ctx, { firstName: "Test", lastName: `Direct-${suffix}` }, "seed");
    const plan = await createTreatmentPlan(
      ctx,
      patient.id,
      {
        practitionerId,
        optionLabel: "Séance du jour",
        items: [{ description: "Détartrage", unitPrice: 120, quantity: 1, status: "completed" }],
      },
      "dr-meyer",
    );
    const itemId = plan.options[0]!.items[0]!.id;

    const treatment = await prisma.treatment.findFirst({ where: { treatmentPlanItemId: itemId } });
    expect(treatment).not.toBeNull();
    expect(treatment?.status).toBe("completed");

    const soins = await listSoinsForPatient(ctx, patient.id);
    expect(soins).toHaveLength(1);
    expect(soins[0]!.status).toBe("to_invoice");
  });

  it("marking a planned item completed later creates exactly one Treatment record", async () => {
    const patient = await createPatient(ctx, { firstName: "Test", lastName: `Later-${suffix}` }, "seed");
    const plan = await createTreatmentPlan(
      ctx,
      patient.id,
      { practitionerId, optionLabel: "Option A", items: [{ description: "Couronne", unitPrice: 900, quantity: 1 }] },
      "dr-meyer",
    );
    const itemId = plan.options[0]!.items[0]!.id;

    let soins = await listSoinsForPatient(ctx, patient.id);
    expect(soins[0]!.status).toBe("planned");

    await updateTreatmentPlanItemStatus(ctx, itemId, "completed", "dr-meyer");

    const treatments = await prisma.treatment.findMany({ where: { treatmentPlanItemId: itemId } });
    expect(treatments).toHaveLength(1);

    soins = await listSoinsForPatient(ctx, patient.id);
    expect(soins[0]!.status).toBe("to_invoice");
  });

  it("follows a soin from prévu through payé as the quote/invoice/payment chain is built", async () => {
    const patient = await createPatient(ctx, { firstName: "Test", lastName: `FullChain-${suffix}` }, "seed");
    const plan = await createTreatmentPlan(
      ctx,
      patient.id,
      { practitionerId, optionLabel: "Option A", items: [{ description: "Implant", unitPrice: 2200, quantity: 1 }] },
      "dr-meyer",
    );
    const optionId = plan.options[0]!.id;
    const itemId = plan.options[0]!.items[0]!.id;

    expect((await listSoinsForPatient(ctx, patient.id))[0]!.status).toBe("planned");

    await updateTreatmentPlanItemStatus(ctx, itemId, "completed", "dr-meyer");
    expect((await listSoinsForPatient(ctx, patient.id))[0]!.status).toBe("to_invoice");

    const quote = await createQuoteFromPlanOption(ctx, optionId, undefined, "dr-meyer");
    expect(quote.items[0]!.treatmentPlanItemId).toBe(itemId);
    // Still "to_invoice": a quote exists, but nothing has been invoiced yet.
    expect((await listSoinsForPatient(ctx, patient.id))[0]!.status).toBe("to_invoice");

    const invoice = await createInvoiceFromQuote(ctx, quote.id, undefined, "dr-meyer");
    expect(invoice.items[0]!.treatmentId).not.toBeNull();
    expect((await listSoinsForPatient(ctx, patient.id))[0]!.status).toBe("invoiced");

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "paid", balance: 0, amountPaid: invoice.total } });
    expect((await listSoinsForPatient(ctx, patient.id))[0]!.status).toBe("paid");
  });

  it("never mixes soins from another organization's patient into listSoinsForPatient", async () => {
    const otherOrg = await prisma.organization.create({
      data: { name: `Treatment Status Test Org B ${suffix}`, slug: `treatment-status-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({
      data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" },
    });
    const otherCtx = { organizationId: otherOrg.id, clinicId: otherClinic.id };
    const otherPractitioner = await prisma.practitioner.create({
      data: { organizationId: otherOrg.id, clinicId: otherClinic.id, firstName: "Dr", lastName: `Other-${suffix}` },
    });
    const otherPatient = await createPatient(otherCtx, { firstName: "Foreign", lastName: `Patient-${suffix}` }, "seed");
    await createTreatmentPlan(
      otherCtx,
      otherPatient.id,
      { practitionerId: otherPractitioner.id, optionLabel: "Option A", items: [{ description: "Extraction", unitPrice: 150, quantity: 1 }] },
      "seed",
    );

    const patient = await createPatient(ctx, { firstName: "Test", lastName: `Isolation-${suffix}` }, "seed");
    const soins = await listSoinsForPatient(ctx, patient.id);
    expect(soins).toHaveLength(0);

    await prisma.treatmentPlanItem.deleteMany({ where: { treatmentPlanOption: { treatmentPlan: { organizationId: otherOrg.id } } } });
    await prisma.treatmentPlanOption.deleteMany({ where: { treatmentPlan: { organizationId: otherOrg.id } } });
    await prisma.treatmentPlan.deleteMany({ where: { organizationId: otherOrg.id } });
    await prisma.patient.deleteMany({ where: { organizationId: otherOrg.id } });
    await prisma.practitioner.deleteMany({ where: { organizationId: otherOrg.id } });
    await prisma.clinic.deleteMany({ where: { organizationId: otherOrg.id } });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
