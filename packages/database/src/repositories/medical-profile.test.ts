import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
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
});
