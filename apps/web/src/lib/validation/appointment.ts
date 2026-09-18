import { z } from "zod";

function optionalText(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
}

const baseAppointmentFields = {
  patientId: optionalText(50),
  practitionerId: z.string().trim().min(1, "Le praticien est requis"),
  roomId: optionalText(50),
  appointmentTypeId: optionalText(50),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "Heure de début invalide"),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  notes: optionalText(2000),
};

function toStartEnd(value: { date: string; startTime: string; durationMinutes: number }): {
  startAt: Date;
  endAt: Date;
} {
  const startAt = new Date(`${value.date}T${value.startTime}:00`);
  const endAt = new Date(startAt.getTime() + value.durationMinutes * 60_000);
  return { startAt, endAt };
}

export const createAppointmentSchema = z.object(baseAppointmentFields).transform((value) => ({
  patientId: value.patientId,
  practitionerId: value.practitionerId,
  roomId: value.roomId,
  appointmentTypeId: value.appointmentTypeId,
  notes: value.notes,
  ...toStartEnd(value),
}));

export const updateAppointmentSchema = z
  .object({ appointmentId: z.string().trim().min(1), ...baseAppointmentFields })
  .transform((value) => ({
    appointmentId: value.appointmentId,
    patientId: value.patientId,
    practitionerId: value.practitionerId,
    roomId: value.roomId,
    appointmentTypeId: value.appointmentTypeId,
    notes: value.notes,
    ...toStartEnd(value),
  }));

export const quickCreatePatientSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
  lastName: z.string().trim().min(1, "Le nom est requis").max(100),
  phone: optionalText(30),
  dateOfBirth: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.date().optional(),
  ),
});
