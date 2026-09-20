import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import {
  createLabCase,
  createLaboratory,
  listLabCases,
  listLabCasesForPatient,
  listLaboratories,
  updateLabCaseStatus,
} from "./laboratories";
import { createPatient } from "./patients";

/** ÉTAPE 17 : un cas de laboratoire reste scopé par clinique/organisation, le worklist clinique ne
 * remonte que les cas encore ouverts triés par échéance, et le passage à "sent"/"received" horodate
 * automatiquement le bon champ. */
describe("laboratories repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let practitionerId = "";
  let laboratoryId = "";
  let patientId = "";
  let otherPatientId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Lab Test Org ${suffix}`, slug: `lab-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Lab Test Org B ${suffix}`, slug: `lab-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({ data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" } });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Lab-${suffix}` },
    });
    practitionerId = practitioner.id;

    const laboratory = await createLaboratory(ctx, { name: `Prothésiste ${suffix}` });
    laboratoryId = laboratory.id;

    const patient = await createPatient(ctx, { firstName: "Lab", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;
    const otherPatient = await createPatient(otherCtx, { firstName: "Other", lastName: `Test-${suffix}` }, "seed");
    otherPatientId = otherPatient.id;
  });

  afterAll(async () => {
    await prisma.labCase.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.laboratory.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.practitioner.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("creates a laboratory and a case, both listed", async () => {
    const labs = await listLaboratories(ctx);
    expect(labs.some((l) => l.id === laboratoryId)).toBe(true);

    const labCase = await createLabCase(ctx, {
      patientId,
      practitionerId,
      laboratoryId,
      workType: "Couronne céramique",
      toothNumber: 26,
    });
    expect(labCase.status).toBe("to_send");

    const patientCases = await listLabCasesForPatient(ctx, patientId);
    expect(patientCases.some((c) => c.id === labCase.id)).toBe(true);
  });

  it("refuses to create a case for a patient/practitioner/lab outside the tenant", async () => {
    await expect(
      createLabCase(ctx, { patientId: otherPatientId, practitionerId, laboratoryId, workType: "x" }),
    ).rejects.toThrow(/not found/i);
    await expect(
      createLabCase(ctx, { patientId, practitionerId: "does-not-exist", laboratoryId, workType: "x" }),
    ).rejects.toThrow(/not found/i);
    await expect(
      createLabCase(ctx, { patientId, practitionerId, laboratoryId: "does-not-exist", workType: "x" }),
    ).rejects.toThrow(/not found/i);
  });

  it("stamps sentAt/receivedAt automatically when the status crosses those points", async () => {
    const labCase = await createLabCase(ctx, { patientId, practitionerId, laboratoryId, workType: "Bridge" });
    expect(labCase.sentAt).toBeNull();

    const sent = await updateLabCaseStatus(ctx, labCase.id, "sent");
    expect(sent.sentAt).not.toBeNull();

    const inProduction = await updateLabCaseStatus(ctx, labCase.id, "in_production");
    expect(inProduction.receivedAt).toBeNull();

    const received = await updateLabCaseStatus(ctx, labCase.id, "received");
    expect(received.receivedAt).not.toBeNull();
  });

  it("the clinic worklist only returns open cases, soonest expected date first", async () => {
    const soon = await createLabCase(ctx, { patientId, practitionerId, laboratoryId, workType: "A", expectedAt: new Date("2026-02-01") });
    const later = await createLabCase(ctx, { patientId, practitionerId, laboratoryId, workType: "B", expectedAt: new Date("2026-06-01") });
    const done = await createLabCase(ctx, { patientId, practitionerId, laboratoryId, workType: "C" });
    await updateLabCaseStatus(ctx, done.id, "completed");

    const worklist = await listLabCases(ctx);
    expect(worklist.some((c) => c.id === done.id)).toBe(false);
    const ids = worklist.map((c) => c.id);
    expect(ids.indexOf(soon.id)).toBeLessThan(ids.indexOf(later.id));
    expect(worklist[0]!.patient.lastName).toContain(suffix);
  });

  it("never updates or lists another organization's lab case", async () => {
    const otherLab = await createLaboratory(otherCtx, { name: "Foreign lab" });
    const otherPractitioner = await prisma.practitioner.create({
      data: { organizationId: otherCtx.organizationId, clinicId: otherCtx.clinicId, firstName: "Dr", lastName: "Foreign" },
    });
    const foreignCase = await createLabCase(otherCtx, {
      patientId: otherPatientId,
      practitionerId: otherPractitioner.id,
      laboratoryId: otherLab.id,
      workType: "Foreign",
    });

    await expect(updateLabCaseStatus(ctx, foreignCase.id, "sent")).rejects.toThrow(/not found/i);
    const worklist = await listLabCases(ctx);
    expect(worklist.some((c) => c.id === foreignCase.id)).toBe(false);
  });
});
