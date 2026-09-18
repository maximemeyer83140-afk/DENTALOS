import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppointmentConflictError } from "../services/appointment-conflict";
import { prisma } from "../index";
import { createAppointment, listAppointmentsForDay } from "./appointments";

/**
 * The agenda's non-negotiable rule (sections 18/82): the server must refuse to double-book a
 * practitioner or a room, regardless of what the calendar UI shows. Also covers tenant isolation,
 * consistent with every other repository.
 */
describe("appointments repository", () => {
  const suffix = randomUUID().slice(0, 8);
  const ctx = { organizationId: "", clinicId: "" };
  const otherCtx = { organizationId: "", clinicId: "" };
  let practitionerA = "";
  let practitionerB = "";
  let roomA = "";
  const day = new Date("2026-10-05T00:00:00.000Z");

  function slot(hour: number, minutes = 30) {
    const start = new Date(day);
    start.setUTCHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + minutes * 60_000);
    return { startAt: start, endAt: end };
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Appointments Test Org ${suffix}`, slug: `appointments-test-org-${suffix}` },
    });
    const clinic = await prisma.clinic.create({
      data: { organizationId: org.id, name: "Clinic", slug: "main" },
    });
    ctx.organizationId = org.id;
    ctx.clinicId = clinic.id;

    const otherOrg = await prisma.organization.create({
      data: { name: `Appointments Test Org B ${suffix}`, slug: `appointments-test-org-b-${suffix}` },
    });
    const otherClinic = await prisma.clinic.create({
      data: { organizationId: otherOrg.id, name: "Clinic B", slug: "main" },
    });
    otherCtx.organizationId = otherOrg.id;
    otherCtx.clinicId = otherClinic.id;

    const [pA, pB] = await Promise.all([
      prisma.practitioner.create({
        data: { organizationId: org.id, clinicId: clinic.id, firstName: "Alice", lastName: `A-${suffix}` },
      }),
      prisma.practitioner.create({
        data: { organizationId: org.id, clinicId: clinic.id, firstName: "Bob", lastName: `B-${suffix}` },
      }),
    ]);
    practitionerA = pA.id;
    practitionerB = pB.id;

    const room = await prisma.room.create({ data: { clinicId: clinic.id, name: "Salle 1" } });
    roomA = room.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({
      where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } },
    });
    await prisma.practitioner.deleteMany({ where: { organizationId: ctx.organizationId } });
    await prisma.room.deleteMany({ where: { clinicId: ctx.clinicId } });
    await prisma.clinic.deleteMany({
      where: { organizationId: { in: [ctx.organizationId, otherCtx.organizationId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [ctx.organizationId, otherCtx.organizationId] } },
    });
  });

  it("allows the first booking on a slot", async () => {
    const { startAt, endAt } = slot(8);
    const appt = await createAppointment(ctx, { practitionerId: practitionerA, roomId: roomA, startAt, endAt }, "seed");
    expect(appt.practitionerId).toBe(practitionerA);
  });

  it("rejects an overlapping booking for the same practitioner", async () => {
    const first = slot(9);
    await createAppointment(ctx, { practitionerId: practitionerA, startAt: first.startAt, endAt: first.endAt }, "seed");

    const overlapping = slot(9, 15); // starts 15 min into the first appointment
    await expect(
      createAppointment(ctx, { practitionerId: practitionerA, startAt: overlapping.startAt, endAt: overlapping.endAt }, "seed"),
    ).rejects.toThrow(AppointmentConflictError);
  });

  it("allows a different practitioner on the exact same slot (no room)", async () => {
    const { startAt, endAt } = slot(10);
    await createAppointment(ctx, { practitionerId: practitionerA, startAt, endAt }, "seed");
    const forB = await createAppointment(ctx, { practitionerId: practitionerB, startAt, endAt }, "seed");
    expect(forB.practitionerId).toBe(practitionerB);
  });

  it("rejects two different practitioners double-booking the same room", async () => {
    const { startAt, endAt } = slot(11);
    await createAppointment(ctx, { practitionerId: practitionerA, roomId: roomA, startAt, endAt }, "seed");

    await expect(
      createAppointment(ctx, { practitionerId: practitionerB, roomId: roomA, startAt, endAt }, "seed"),
    ).rejects.toThrow(AppointmentConflictError);
  });

  it("a cancelled appointment no longer blocks its slot", async () => {
    const { startAt, endAt } = slot(13);
    const first = await createAppointment(ctx, { practitionerId: practitionerA, startAt, endAt }, "seed");
    await prisma.appointment.update({ where: { id: first.id }, data: { status: "cancelled" } });

    const second = await createAppointment(ctx, { practitionerId: practitionerA, startAt, endAt }, "seed");
    expect(second.id).not.toBe(first.id);
  });

  it("never returns another organization's appointments for the same day", async () => {
    const results = await listAppointmentsForDay(ctx, day);
    expect(results.every((a) => a.organizationId === ctx.organizationId)).toBe(true);
  });
});
