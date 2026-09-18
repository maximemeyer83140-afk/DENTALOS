import { z } from "zod";

function optionalText(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
}

export const createNoteSchema = z.object({
  practitionerId: z.string().trim().min(1, "Le praticien est requis"),
  content: z.string().trim().min(1, "Le contenu est requis").max(10_000),
  noteType: optionalText(50),
});

export const createTreatmentPlanSchema = z.object({
  practitionerId: z.string().trim().min(1, "Le praticien est requis"),
  description: z.string().trim().min(1, "La description est requise").max(500),
  unitPrice: z.coerce.number().min(0, "Le prix doit être positif"),
  toothNumber: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(11).max(48).optional(),
  ),
});
