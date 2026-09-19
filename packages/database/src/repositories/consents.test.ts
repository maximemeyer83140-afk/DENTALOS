import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createConsent, listConsentsForPatient, recordConsentDecision } from "./consents";
import { createPatient } from "./patients";

/**
 * ÉTAPE 11 : un consentement décidé (signé/refusé) ne doit plus jamais pouvoir changer — c'est un
 * enregistrement légal, pas un statut qu'on corrige après coup. Une nouvelle demande crée une
 * nouvelle version plutôt que de réécrire l'ancienne.
 */
describe("consents repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let patientId = "";
  let otherPatientId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Consents Test Org ${suffix}`, slug: `consents-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Consents Test Org B ${suffix}`, slug: `consents-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({
      data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" },
    });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const patient = await createPatient(ctx, { firstName: "Consent", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;
    const otherPatient = await createPatient(otherCtx, { firstName: "Other", lastName: `Test-${suffix}` }, "seed");
    otherPatientId = otherPatient.id;
  });

  afterAll(async () => {
    await prisma.consent.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("creates a pending consent request", async () => {
    const consent = await createConsent(ctx, { patientId, templateKey: "consentement_general" }, "dr-meyer");
    expect(consent.status).toBe("pending");
    expect(consent.version).toBe(1);

    const list = await listConsentsForPatient(ctx, patientId);
    expect(list.some((c) => c.id === consent.id)).toBe(true);
  });

  it("refuses to create a consent for a patient from another organization", async () => {
    await expect(
      createConsent(ctx, { patientId: otherPatientId, templateKey: "consentement_general" }, "dr-meyer"),
    ).rejects.toThrow(/not found/i);
  });

  it("bumps the version when the same template is requested again", async () => {
    await createConsent(ctx, { patientId, templateKey: "consentement_implant" }, "dr-meyer");
    const second = await createConsent(ctx, { patientId, templateKey: "consentement_implant" }, "dr-meyer");
    expect(second.version).toBe(2);
  });

  it("records a signed decision and refuses to decide it twice", async () => {
    const consent = await createConsent(ctx, { patientId, templateKey: "consentement_anesthesie" }, "dr-meyer");
    const signed = await recordConsentDecision(ctx, consent.id, { status: "signed", signedByName: "Jean Dupont" });
    expect(signed.status).toBe("signed");
    expect(signed.signedAt).not.toBeNull();
    expect(signed.signedByName).toBe("Jean Dupont");

    await expect(recordConsentDecision(ctx, consent.id, { status: "declined" })).rejects.toThrow(/already decided/i);
  });

  it("never decides another organization's consent", async () => {
    const foreignConsent = await createConsent(otherCtx, { patientId: otherPatientId, templateKey: "rgpd_lpd" }, "seed");
    await expect(recordConsentDecision(ctx, foreignConsent.id, { status: "signed" })).rejects.toThrow(/not found/i);
  });
});
