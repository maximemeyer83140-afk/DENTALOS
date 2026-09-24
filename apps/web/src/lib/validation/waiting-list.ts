import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const waitingListUrgencySchema = z.enum(["low", "normal", "high", "urgent"]);

export const addToWaitingListSchema = z.object({
  appointmentId: z.string().min(1, "Choisissez un rendez-vous déjà fixé."),
  urgency: z.preprocess(emptyToUndefined, waitingListUrgencySchema.optional()),
  availabilityNotes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});
