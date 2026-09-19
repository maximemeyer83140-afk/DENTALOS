import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const createRecallSchema = z.object({
  dueDate: z.string().min(1, "La date d'échéance est obligatoire."),
  reason: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});

export const recallStatusSchema = z.enum(["to_contact", "contacted", "scheduled", "no_response", "declined"]);

export const updateRecallStatusSchema = z.object({
  status: recallStatusSchema,
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});

export const communicationChannelSchema = z.enum(["email", "sms", "call", "letter", "note"]);

export const logCommunicationSchema = z.object({
  channel: communicationChannelSchema,
  subject: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  content: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});
