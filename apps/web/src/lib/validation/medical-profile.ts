import { z } from "zod";

function listFromLines(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export const updateMedicalProfileSchema = z.object({
  allergies: z.preprocess(listFromLines, z.array(z.string())),
  medications: z.preprocess(listFromLines, z.array(z.string())),
  conditions: z.preprocess(listFromLines, z.array(z.string())),
  riskNotes: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(2000).optional(),
  ),
  isPregnant: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  isSmoker: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  onAnticoagulants: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export const addAlertSchema = z.object({
  type: z.enum(["allergy", "medication", "condition", "other"]),
  label: z.string().trim().min(1, "Le libellé est requis").max(200),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
});
