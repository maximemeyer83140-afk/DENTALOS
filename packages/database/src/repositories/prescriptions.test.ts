import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createPatient } from "./patients";
import {
  createPrescription,
  linkPrescriptionDocument,
  listPrescriptionsForPatient,
  updatePrescription,
} from "./prescriptions";

/**
 * Une ordonnance se rédige toujours avec au moins un médicament (jamais vide), et se modifie en
 * remplaçant la liste entière plutôt qu'en la diffant — ces tests suivent ce cycle (créer → lister →
 * corriger avant impression → lier le document imprimé), et vérifient l'isolation multi-tenant.
 */
describe("prescriptions repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let patientId = "";
  let practitionerId = "";
  let otherPatientId = "";
  let otherPractitionerId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Prescriptions Test Org ${suffix}`, slug: `prescriptions-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Rx-${suffix}` },
    });
    practitionerId = practitioner.id;

    const patient = await createPatient(ctx, { firstName: "Rx", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Prescriptions Test Org B ${suffix}`, slug: `prescriptions-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({
      data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" },
    });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const otherPractitioner = await prisma.practitioner.create({
      data: { organizationId: otherOrg.id, clinicId: otherClinic.id, firstName: "Dr", lastName: `Other-${suffix}` },
    });
    otherPractitionerId = otherPractitioner.id;

    const otherPatient = await createPatient(otherCtx, { firstName: "Other", lastName: `Test-${suffix}` }, "seed");
    otherPatientId = otherPatient.id;
  });

  afterAll(async () => {
    await prisma.prescription.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.practitioner.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("creates a prescription with its medication lines", async () => {
    const prescription = await createPrescription(
      ctx,
      patientId,
      {
        practitionerId,
        notes: "En cas d'allergie à la pénicilline, contacter le cabinet.",
        items: [{ medication: "Amoxicilline 500mg", dosage: "1 cp. 3×/jour", duration: "7 jours" }],
      },
      "dr-meyer",
    );
    expect(prescription.items).toHaveLength(1);
    expect(prescription.items[0]!.medication).toBe("Amoxicilline 500mg");

    const list = await listPrescriptionsForPatient(ctx, patientId);
    expect(list.some((rx) => rx.id === prescription.id)).toBe(true);
  });

  it("refuses to create a prescription with no medication lines", async () => {
    await expect(createPrescription(ctx, patientId, { practitionerId, items: [] }, "dr-meyer")).rejects.toThrow(
      /at least one medication/i,
    );
  });

  it("refuses to create a prescription for a patient from another organization", async () => {
    await expect(
      createPrescription(
        ctx,
        otherPatientId,
        { practitionerId, items: [{ medication: "Ibuprofène", dosage: "400mg", duration: "3 jours" }] },
        "dr-meyer",
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("refuses a practitioner from another organization", async () => {
    await expect(
      createPrescription(
        ctx,
        patientId,
        { practitionerId: otherPractitionerId, items: [{ medication: "Ibuprofène", dosage: "400mg", duration: "3 jours" }] },
        "dr-meyer",
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("replaces the medication list wholesale on update ('remplir avant impression')", async () => {
    const prescription = await createPrescription(
      ctx,
      patientId,
      { practitionerId, items: [{ medication: "Paracétamol 500mg", dosage: "1 cp.", duration: "5 jours" }] },
      "dr-meyer",
    );

    const updated = await updatePrescription(ctx, prescription.id, {
      notes: "Corrigé avant impression",
      items: [
        { medication: "Paracétamol 1000mg", dosage: "1 cp. 4×/jour", duration: "5 jours" },
        { medication: "Ibuprofène 400mg", dosage: "1 cp. 3×/jour", duration: "3 jours" },
      ],
    });

    expect(updated.items).toHaveLength(2);
    expect(updated.notes).toBe("Corrigé avant impression");
    expect(updated.items.map((i) => i.medication).sort()).toEqual(["Ibuprofène 400mg", "Paracétamol 1000mg"]);
  });

  it("links a prescription to its printed document", async () => {
    const prescription = await createPrescription(
      ctx,
      patientId,
      { practitionerId, items: [{ medication: "Amoxicilline 500mg", dosage: "1 cp. 3×/jour", duration: "7 jours" }] },
      "dr-meyer",
    );
    const linked = await linkPrescriptionDocument(ctx, prescription.id, "doc-fake-id");
    expect(linked.documentId).toBe("doc-fake-id");
  });

  it("never updates another organization's prescription", async () => {
    const foreignPrescription = await createPrescription(
      otherCtx,
      otherPatientId,
      { practitionerId: otherPractitionerId, items: [{ medication: "Ibuprofène", dosage: "400mg", duration: "3 jours" }] },
      "seed",
    );
    await expect(
      updatePrescription(ctx, foreignPrescription.id, { items: [{ medication: "X", dosage: "Y", duration: "Z" }] }),
    ).rejects.toThrow(/not found/i);
  });
});
