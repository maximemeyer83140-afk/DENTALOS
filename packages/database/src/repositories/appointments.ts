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
  return prisma.appointment.findMany({
    where: { clinicId: ctx.clinicId, startAt: { gte: start, lt: end } },
    include: APPOINTMENT_INCLUDE,
    orderBy: { startAt: "asc" },
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
