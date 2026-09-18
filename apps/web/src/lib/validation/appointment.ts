import { z } from "zod";

function optionalText(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
}

export const createAppointmentSchema = z
  .object({
    patientId: optionalText(50),
    practitionerId: z.string().trim().min(1, "Le praticien est requis"),
    roomId: optionalText(50),
    date: z.string().trim().min(1, "La date est requise"),
    startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "Heure de début invalide"),
    durationMinutes: z.coerce.number().int().min(5).max(480),
    notes: optionalText(2000),
  })
  .transform((value) => {
    const startAt = new Date(`${value.date}T${value.startTime}:00`);
    const endAt = new Date(startAt.getTime() + value.durationMinutes * 60_000);
    return {
      patientId: value.patientId,
      practitionerId: value.practitionerId,
      roomId: value.roomId,
      notes: value.notes,
      startAt,
      endAt,
    };
  });
