import type { Appointment, AppointmentStatus } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import { assertNoConflict } from "../services/appointment-conflict";
import type { TenantContext } from "../tenant-context";

const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true } },
  practitioner: { select: { id: true, firstName: true, lastName: true } },
  room: { select: { id: true, name: true } },
  appointmentType: { select: { id: true, name: true, color: true } },
} as const;

export type AppointmentWithRelations = Appointment & {
  patient: { id: string; firstName: string; lastName: string } | null;
  practitioner: { id: string; firstName: string; lastName: string };
  room: { id: string; name: string } | null;
  appointmentType: { id: string; name: string; color: string | null } | null;
};

export interface CreateAppointmentInput {
  patientId?: string | undefined;
  practitionerId: string;
  roomId?: string | undefined;
  appointmentTypeId?: string | undefined;
  startAt: Date;
  endAt: Date;
  notes?: string | undefined;
}

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function listAppointmentsForDay(
  ctx: TenantContext,
  date: Date,
): Promise<AppointmentWithRelations[]> {
  const { start, end } = dayBounds(date);
  return listAppointmentsForRange(ctx, start, end);
}

/** `end` is exclusive — pass the day after the last day you want included (e.g. the week view
 * passes Monday 00:00 as `start` and the following Monday 00:00 as `end`). */
export async function listAppointmentsForRange(
  ctx: TenantContext,
  start: Date,
  end: Date,
): Promise<AppointmentWithRelations[]> {
  return prisma.appointment.findMany({
    where: { clinicId: ctx.clinicId, startAt: { gte: start, lt: end } },
    include: APPOINTMENT_INCLUDE,
    orderBy: { startAt: "asc" },
  });
}

/** Used by the "Rendez-vous" tab of the fiche patient (ÉTAPE 3) — every past and future
 * appointment for one patient, most recent first. */
export async function listAppointmentsForPatient(
  ctx: TenantContext,
  patientId: string,
): Promise<AppointmentWithRelations[]> {
  return prisma.appointment.findMany({
    where: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, patientId },
    include: APPOINTMENT_INCLUDE,
    orderBy: { startAt: "desc" },
  });
}

export async function getAppointment(ctx: TenantContext, id: string): Promise<AppointmentWithRelations> {
  const appointment = await prisma.appointment.findFirst({
    where: { id, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: APPOINTMENT_INCLUDE,
  });
  if (!appointment) throw new NotFoundError(`Appointment ${id} not found`);
  return appointment;
}

/** Conflict-checked inside the same transaction as the write — see appointment-conflict.ts. */
export async function createAppointment(
  ctx: TenantContext,
  input: CreateAppointmentInput,
  createdBy: string,
): Promise<Appointment> {
  if (input.endAt <= input.startAt) {
    throw new Error("Appointment end time must be after its start time");
  }

  return prisma.$transaction(async (tx) => {
    await assertNoConflict(tx, {
      clinicId: ctx.clinicId,
      practitionerId: input.practitionerId,
      roomId: input.roomId,
      startAt: input.startAt,
      endAt: input.endAt,
    });

    return tx.appointment.create({
      data: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        patientId: input.patientId,
        practitionerId: input.practitionerId,
        roomId: input.roomId,
        appointmentTypeId: input.appointmentTypeId,
        startAt: input.startAt,
        endAt: input.endAt,
        notes: input.notes,
        createdBy,
      },
    });
  });
}

export async function rescheduleAppointment(
  ctx: TenantContext,
  appointmentId: string,
  startAt: Date,
  endAt: Date,
): Promise<Appointment> {
  if (endAt <= startAt) {
    throw new Error("Appointment end time must be after its start time");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: { id: appointmentId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    });
    if (!existing) throw new NotFoundError(`Appointment ${appointmentId} not found`);

    await assertNoConflict(tx, {
      clinicId: ctx.clinicId,
      practitionerId: existing.practitionerId,
      roomId: existing.roomId,
      startAt,
      endAt,
      excludeAppointmentId: appointmentId,
    });

    return tx.appointment.update({ where: { id: appointmentId }, data: { startAt, endAt } });
  });
}

export interface UpdateAppointmentInput {
  patientId?: string | null | undefined;
  practitionerId?: string | undefined;
  roomId?: string | null | undefined;
  appointmentTypeId?: string | null | undefined;
  startAt?: Date | undefined;
  endAt?: Date | undefined;
  notes?: string | null | undefined;
}

/**
 * The full edit path (time, practitioner, room, type, patient, notes — anything the appointment
 * modal's edit mode can touch), as opposed to `rescheduleAppointment`'s narrow drag-and-drop case.
 * Only re-checks the conflict engine when the time, practitioner, or room actually change — editing
 * just the notes or the appointment type on an otherwise-untouched slot shouldn't ever be blocked
 * by a conflict that has nothing to do with the fields being changed.
 */
export async function updateAppointment(
  ctx: TenantContext,
  appointmentId: string,
  input: UpdateAppointmentInput,
): Promise<Appointment> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: { id: appointmentId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    });
    if (!existing) throw new NotFoundError(`Appointment ${appointmentId} not found`);

    const nextStartAt = input.startAt ?? existing.startAt;
    const nextEndAt = input.endAt ?? existing.endAt;
    if (nextEndAt <= nextStartAt) {
      throw new Error("Appointment end time must be after its start time");
    }
    const nextPractitionerId = input.practitionerId ?? existing.practitionerId;
    const nextRoomId = input.roomId !== undefined ? input.roomId : existing.roomId;

    const resourcesChanged =
      nextStartAt.getTime() !== existing.startAt.getTime() ||
      nextEndAt.getTime() !== existing.endAt.getTime() ||
      nextPractitionerId !== existing.practitionerId ||
      nextRoomId !== existing.roomId;

    if (resourcesChanged) {
      await assertNoConflict(tx, {
        clinicId: ctx.clinicId,
        practitionerId: nextPractitionerId,
        roomId: nextRoomId,
        startAt: nextStartAt,
        endAt: nextEndAt,
        excludeAppointmentId: appointmentId,
      });
    }

    return tx.appointment.update({
      where: { id: appointmentId },
      data: {
        patientId: input.patientId,
        practitionerId: input.practitionerId,
        roomId: input.roomId,
        appointmentTypeId: input.appointmentTypeId,
        startAt: input.startAt,
        endAt: input.endAt,
        notes: input.notes,
      },
    });
  });
}

export async function updateAppointmentStatus(
  ctx: TenantContext,
  appointmentId: string,
  status: AppointmentStatus,
): Promise<Appointment> {
  const result = await prisma.appointment.updateMany({
    where: { id: appointmentId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: { status },
  });
  if (result.count === 0) throw new NotFoundError(`Appointment ${appointmentId} not found`);
  return getAppointment(ctx, appointmentId);
}
