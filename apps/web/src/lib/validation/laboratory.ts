import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const createLaboratorySchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(200),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email().optional()),
});

const optionalToothNumber = z.preprocess(emptyToUndefined, z.coerce.number().int().min(11).max(48).optional());

export const createLabCaseSchema = z.object({
  practitionerId: z.string().trim().min(1, "Le praticien est obligatoire."),
  laboratoryId: z.string().trim().min(1, "Le laboratoire est obligatoire."),
  workType: z.string().trim().min(1, "Le type de travail est obligatoire.").max(200),
  toothNumber: optionalToothNumber,
  expectedAt: z.preprocess(emptyToUndefined, z.string().optional()),
  cost: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
});

export const labCaseStatusSchema = z.enum(["to_send", "sent", "in_production", "received", "fitted", "completed"]);

export const updateLabCaseStatusSchema = z.object({
  status: labCaseStatusSchema,
});
