import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const createConsentSchema = z.object({
  templateKey: z.string().trim().min(1, "Le type de consentement est obligatoire.").max(100),
});

export const recordConsentDecisionSchema = z.object({
  status: z.enum(["signed", "declined"]),
  signedByName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
});
