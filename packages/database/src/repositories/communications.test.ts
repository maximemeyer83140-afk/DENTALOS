import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { listCommunicationsForPatient, logCommunication } from "./communications";
import { createPatient } from "./patients";

/**
 * ÉTAPE 10 : le journal des communications reste scopé par patient/organisation, et remonte les
 * entrées les plus récentes en premier (jamais un tri implicite dépendant de l'ordre d'insertion).
 */
describe("communications repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let patientId = "";
  let otherPatientId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Comms Test Org ${suffix}`, slug: `comms-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Comms Test Org B ${suffix}`, slug: `comms-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({
      data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" },
    });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const patient = await createPatient(ctx, { firstName: "Comm", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;
    const otherPatient = await createPatient(otherCtx, { firstName: "Other", lastName: `Test-${suffix}` }, "seed");
    otherPatientId = otherPatient.id;
  });

  afterAll(async () => {
    await prisma.communication.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  it("logs a communication and defaults to outbound", async () => {
    const comm = await logCommunication(
      ctx,
      { patientId, channel: "sms", subject: "Rappel RDV", content: "Votre RDV est demain à 9h" },
      "dr-meyer",
    );
    expect(comm.direction).toBe("outbound");
    expect(comm.sentAt).not.toBeNull();

    const list = await listCommunicationsForPatient(ctx, patientId);
    expect(list.some((c) => c.id === comm.id)).toBe(true);
  });

  it("refuses to log a communication for a patient from another organization", async () => {
    await expect(
      logCommunication(ctx, { patientId: otherPatientId, channel: "email" }, "dr-meyer"),
    ).rejects.toThrow(/not found/i);
  });

  it("lists newest communication first", async () => {
    const first = await logCommunication(ctx, { patientId, channel: "call", content: "Premier appel" }, "dr-meyer");
    const second = await logCommunication(ctx, { patientId, channel: "call", content: "Second appel" }, "dr-meyer");

    const list = await listCommunicationsForPatient(ctx, patientId);
    const firstIdx = list.findIndex((c) => c.id === first.id);
    const secondIdx = list.findIndex((c) => c.id === second.id);
    expect(secondIdx).toBeLessThan(firstIdx);
  });

  it("never lists another organization's communications", async () => {
    await logCommunication(otherCtx, { patientId: otherPatientId, channel: "letter" }, "seed");
    const list = await listCommunicationsForPatient(ctx, patientId);
    expect(list.every((c) => c.organizationId === ctx.organizationId)).toBe(true);
  });
});
