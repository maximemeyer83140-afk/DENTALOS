import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createPatient } from "./patients";
import { createRecall, listRecalls, listRecallsForPatient, updateRecallStatus } from "./recalls";

/**
 * ÉTAPE 10 : les rappels de contrôle doivent rester scopés par clinique/organisation, et le
 * worklist clinique ne doit remonter que les rappels encore ouverts, triés par échéance.
 */
describe("recalls repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let patientId = "";
  let otherPatientId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Recalls Test Org ${suffix}`, slug: `recalls-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Recalls Test Org B ${suffix}`, slug: `recalls-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({
      data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" },
    });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const patient = await createPatient(ctx, { firstName: "Recall", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;
    const otherPatient = await createPatient(otherCtx, { firstName: "Other", lastName: `Test-${suffix}` }, "seed");
    otherPatientId = otherPatient.id;
  });

  afterAll(async () => {
    await prisma.recall.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("creates a recall and lists it for its patient", async () => {
    const recall = await createRecall(ctx, {
      patientId,
      dueDate: new Date("2027-01-15"),
      reason: "Contrôle annuel",
    });
    expect(recall.status).toBe("to_contact");

    const list = await listRecallsForPatient(ctx, patientId);
    expect(list.some((r) => r.id === recall.id)).toBe(true);
  });

  it("refuses to attach a recall to a patient from another organization", async () => {
    await expect(
      createRecall(ctx, { patientId: otherPatientId, dueDate: new Date("2027-01-15") }),
    ).rejects.toThrow(/not found/i);
  });

  it("the clinic worklist only returns open recalls, soonest due date first", async () => {
    const soon = await createRecall(ctx, { patientId, dueDate: new Date("2026-02-01"), reason: "Détartrage" });
    const later = await createRecall(ctx, { patientId, dueDate: new Date("2026-06-01"), reason: "Contrôle" });
    const declined = await createRecall(ctx, { patientId, dueDate: new Date("2026-01-01"), reason: "Ancien" });
    await updateRecallStatus(ctx, declined.id, "declined");

    const worklist = await listRecalls(ctx);
    expect(worklist.some((r) => r.id === declined.id)).toBe(false);
    const ids = worklist.map((r) => r.id);
    expect(ids.indexOf(soon.id)).toBeLessThan(ids.indexOf(later.id));
    expect(worklist[0]!.patient.lastName).toContain(suffix);
  });

  it("moves a recall through its status lifecycle", async () => {
    const recall = await createRecall(ctx, { patientId, dueDate: new Date("2027-03-01"), reason: "Contrôle" });
    const contacted = await updateRecallStatus(ctx, recall.id, "contacted", "Laissé un message");
    expect(contacted.status).toBe("contacted");
    expect(contacted.notes).toBe("Laissé un message");

    const scheduled = await updateRecallStatus(ctx, recall.id, "scheduled");
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.notes).toBe("Laissé un message");
  });

  it("never updates or lists another organization's recall", async () => {
    const foreignRecall = await createRecall(otherCtx, { patientId: otherPatientId, dueDate: new Date("2027-01-01") });

    await expect(updateRecallStatus(ctx, foreignRecall.id, "contacted")).rejects.toThrow(/not found/i);
    const worklist = await listRecalls(ctx);
    expect(worklist.some((r) => r.id === foreignRecall.id)).toBe(false);
  });
});
