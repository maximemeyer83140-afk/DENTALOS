import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../index";
import { createPatient } from "./patients";
import { addToWaitingList, listWaitingList, removeFromWaitingList } from "./waiting-list";

/**
 * Une entrée de liste d'attente n'a de sens que rattachée à un rendez-vous déjà fixé — voir
 * schema.prisma (WaitingListEntry.appointmentId, obligatoire). Ces tests couvrent donc autant les
 * refus (pas de patient sur le créneau, rendez-vous annulé/passé, doublon) que le cas nominal.
 */
describe("waiting-list repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let patientId = "";
  let practitionerId = "";
  let appointmentTypeId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Waiting List Test Org ${suffix}`, slug: `waiting-list-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({ data: { organizationId: org.id, name: "Clinic", slug: "main" } });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Waiting List Test Org B ${suffix}`, slug: `waiting-list-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({
      data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" },
    });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const patient = await createPatient(ctx, { firstName: "Attente", lastName: `Test-${suffix}` }, "seed");
    patientId = patient.id;

    const practitioner = await prisma.practitioner.create({
      data: { organizationId: org.id, clinicId: clinic.id, firstName: "Dr", lastName: `Test-${suffix}` },
    });
    practitionerId = practitioner.id;

    const appointmentType = await prisma.appointmentType.create({
      data: { clinicId: clinic.id, name: `Contrôle-${suffix}`, defaultDurationMinutes: 30 },
    });
    appointmentTypeId = appointmentType.id;
  });

  afterAll(async () => {
    await prisma.waitingListEntry.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.appointmentType.deleteMany({ where: { clinicId: { in: [ctx.clinicId, otherCtx.clinicId] } } });
    await prisma.practitioner.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.clinic.deleteMany({ where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } } });
  });

  function futureAppointment(patientIdOverride: string | null, minutesFromNow: number) {
    const startAt = new Date(Date.now() + minutesFromNow * 60_000);
    const endAt = new Date(startAt.getTime() + 30 * 60_000);
    return prisma.appointment.create({
      data: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        patientId: patientIdOverride,
        practitionerId,
        appointmentTypeId,
        startAt,
        endAt,
      },
    });
  }

  it("adds a patient with an already-scheduled appointment to the waiting list", async () => {
    const appointment = await futureAppointment(patientId, 60 * 24 * 30);
    const entry = await addToWaitingList(ctx, { appointmentId: appointment.id });
    expect(entry.patientId).toBe(patientId);
    expect(entry.appointmentId).toBe(appointment.id);
    expect(entry.status).toBe("waiting");

    const list = await listWaitingList(ctx);
    expect(list.some((e) => e.id === entry.id)).toBe(true);
  });

  it("refuses an appointment slot with no patient attached", async () => {
    const appointment = await futureAppointment(null, 60 * 24 * 31);
    await expect(addToWaitingList(ctx, { appointmentId: appointment.id })).rejects.toThrow(/patient associé/);
  });

  it("refuses a cancelled appointment", async () => {
    const appointment = await futureAppointment(patientId, 60 * 24 * 32);
    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "cancelled" } });
    await expect(addToWaitingList(ctx, { appointmentId: appointment.id })).rejects.toThrow(/annulé/);
  });

  it("refuses a past appointment", async () => {
    const appointment = await futureAppointment(patientId, -60);
    await expect(addToWaitingList(ctx, { appointmentId: appointment.id })).rejects.toThrow(/déjà passé/);
  });

  it("refuses a duplicate active entry for the same appointment", async () => {
    const appointment = await futureAppointment(patientId, 60 * 24 * 33);
    await addToWaitingList(ctx, { appointmentId: appointment.id });
    await expect(addToWaitingList(ctx, { appointmentId: appointment.id })).rejects.toThrow(/déjà en liste d'attente/);
  });

  it("refuses an appointment belonging to another organization", async () => {
    const otherPatient = await createPatient(otherCtx, { firstName: "Autre", lastName: `Test-${suffix}` }, "seed");
    const otherPractitioner = await prisma.practitioner.create({
      data: { organizationId: otherCtx.organizationId, clinicId: otherCtx.clinicId, firstName: "Dr", lastName: `Other-${suffix}` },
    });
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: otherCtx.organizationId,
        clinicId: otherCtx.clinicId,
        patientId: otherPatient.id,
        practitionerId: otherPractitioner.id,
        startAt: new Date(Date.now() + 60 * 24 * 34 * 60_000),
        endAt: new Date(Date.now() + (60 * 24 * 34 + 30) * 60_000),
      },
    });
    await expect(addToWaitingList(ctx, { appointmentId: appointment.id })).rejects.toThrow(/not found/i);
  });

  it("removes an entry from the waiting list", async () => {
    const appointment = await futureAppointment(patientId, 60 * 24 * 35);
    const entry = await addToWaitingList(ctx, { appointmentId: appointment.id });
    await removeFromWaitingList(ctx, entry.id, "cancelled");

    const list = await listWaitingList(ctx);
    expect(list.some((e) => e.id === entry.id)).toBe(false);
  });

  it("never removes another organization's entry", async () => {
    const appointment = await futureAppointment(patientId, 60 * 24 * 36);
    const entry = await addToWaitingList(ctx, { appointmentId: appointment.id });
    await expect(removeFromWaitingList(otherCtx, entry.id, "cancelled")).rejects.toThrow(/not found/i);
  });
});
