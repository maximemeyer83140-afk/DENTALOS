import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { listActiveAlerts } from "./medical-alerts";
import { getMedicalProfile, listMedicalProfileRevisions, updateMedicalProfile } from "./medical-profile";
import { createPatient } from "./patients";

/**
 * Section 6 of the brief: a patient's medical profile must never be overwritten silently. Every
 * update beyond the first has to leave a readable trace of what it replaced.
 */
describe("medical profile versioning", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  let patientId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Medical Profile Test Org ${suffix}`, slug: `medical-profile-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({
      data: { organizationId: org.id, name: "Clinic", slug: "main" },
    });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const patient = await createPatient(ctx, { firstName: "Test", lastName: `Patient-${suffix}` }, "seed");
    patientId = patient.id;
  });

  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.clinic.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.organization.delete({ where: { id: ctx.organizationId } });
  });

  it("creates the profile at version 1 with no revision on first write", async () => {
    const profile = await updateMedicalProfile(
      ctx,
      patientId,
      { allergies: ["Pénicilline"] },
      "dr-meyer",
    );
    expect(profile.version).toBe(1);
    expect(profile.allergies).toEqual(["Pénicilline"]);

    const revisions = await listMedicalProfileRevisions(ctx, patientId);
    expect(revisions).toHaveLength(0);
  });

  it("snapshots the previous state into a revision on every subsequent update", async () => {
    const updated = await updateMedicalProfile(
      ctx,
      patientId,
      { allergies: ["Pénicilline", "Latex"], riskNotes: "Anticoagulants" },
      "dr-meyer",
    );
    expect(updated.version).toBe(2);

    const revisions = await listMedicalProfileRevisions(ctx, patientId);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.version).toBe(1);
    expect((revisions[0]?.snapshot as { allergies: string[] }).allergies).toEqual(["Pénicilline"]);

    const current = await getMedicalProfile(ctx, patientId);
    expect(current?.allergies).toEqual(["Pénicilline", "Latex"]);
    expect(current?.riskNotes).toBe("Anticoagulants");
  });

  it("keeps fields not present in a partial update unchanged", async () => {
    const updated = await updateMedicalProfile(ctx, patientId, { isSmoker: true }, "dr-meyer");
    expect(updated.version).toBe(3);
    expect(updated.allergies).toEqual(["Pénicilline", "Latex"]);
    expect(updated.riskNotes).toBe("Anticoagulants");
    expect(updated.isSmoker).toBe(true);
  });

  it("stores the structured pathologies questionnaire and medications list", async () => {
    const updated = await updateMedicalProfile(
      ctx,
      patientId,
      {
        pathologies: { diabetes: { present: true, notes: "Type 2" }, epilepsy: { present: false } },
        medications: [{ name: "Eliquis", dose: "5mg", frequency: "2x/jour" }],
      },
      "dr-meyer",
    );
    expect(updated.pathologies).toEqual({ diabetes: { present: true, notes: "Type 2" }, epilepsy: { present: false } });
    expect(updated.medications).toEqual([{ name: "Eliquis", dose: "5mg", frequency: "2x/jour" }]);
  });

  it("auto-creates a banner alert when anamnèse marks the patient allergic, and clears it when unmarked", async () => {
    await updateMedicalProfile(ctx, patientId, { allergies: ["Pénicilline"] }, "dr-meyer");
    let alerts = await listActiveAlerts(ctx, patientId);
    expect(alerts.some((a) => a.label.includes("Pénicilline"))).toBe(true);

    await updateMedicalProfile(ctx, patientId, { allergies: [] }, "dr-meyer");
    alerts = await listActiveAlerts(ctx, patientId);
    expect(alerts.some((a) => a.label.toLowerCase().includes("allergie"))).toBe(false);
  });

  it("auto-creates a banner alert for anticoagulants and antiplatelets independently", async () => {
    await updateMedicalProfile(ctx, patientId, { onAnticoagulants: true, onAntiplatelets: true }, "dr-meyer");
    const alerts = await listActiveAlerts(ctx, patientId);
    expect(alerts.some((a) => a.label === "Traitement anticoagulant")).toBe(true);
    expect(alerts.some((a) => a.label === "Traitement antiagrégant")).toBe(true);
  });

  it("never deactivates a manually-added alert when syncing derived ones", async () => {
    const { addAlert } = await import("./medical-alerts");
    await addAlert(ctx, patientId, { type: "other", label: "Patient anxieux — prévoir prémédication" }, "dr-meyer");
    await updateMedicalProfile(ctx, patientId, { riskNotes: "rien de neuf" }, "dr-meyer");
    const alerts = await listActiveAlerts(ctx, patientId);
    expect(alerts.some((a) => a.label === "Patient anxieux — prévoir prémédication")).toBe(true);
  });
});
