import { z } from "zod";

import { PATHOLOGY_DEFS } from "../anamnese";

function listFromLines(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function checkboxToBoolean(value: unknown): unknown {
  return value === "on" || value === true;
}

const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const pathologyEntrySchema = z.object({
  present: z.boolean(),
  notes: optionalText(500),
});

const medicationEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  dose: optionalText(100),
  frequency: optionalText(100),
  comment: optionalText(300),
});

/**
 * ÉTAPE 4 : questionnaire médical structuré. `pathologies` covers the fixed 13-item list
 * (PATHOLOGY_DEFS); `medications` is the repeatable nom/dose/fréquence/commentaire list. Both are
 * assembled from raw FormData by `parseMedicalProfileFormData` below rather than the usual
 * `Object.fromEntries(formData.entries())` pattern used elsewhere in this app, because that
 * pattern silently keeps only the last value for a repeated field name — exactly what the
 * medications list's parallel `medName`/`medDose`/... arrays rely on not happening.
 */
export const updateMedicalProfileSchema = z.object({
  pathologies: z.record(z.string(), pathologyEntrySchema),
  medications: z.array(medicationEntrySchema),
  allergies: z.preprocess(listFromLines, z.array(z.string())),
  pastSurgeries: z.preprocess(listFromLines, z.array(z.string())),
  treatingPhysician: optionalText(200),
  riskNotes: optionalText(2000),
  isPregnant: z.preprocess(checkboxToBoolean, z.boolean()),
  isSmoker: z.preprocess(checkboxToBoolean, z.boolean()),
  alcoholUse: z.preprocess(checkboxToBoolean, z.boolean()),
  onAnticoagulants: z.preprocess(checkboxToBoolean, z.boolean()),
  onAntiplatelets: z.preprocess(checkboxToBoolean, z.boolean()),
});

export type UpdateMedicalProfileInput = z.infer<typeof updateMedicalProfileSchema>;

export function parseMedicalProfileFormData(formData: FormData): ReturnType<typeof updateMedicalProfileSchema.safeParse> {
  const pathologies: Record<string, { present: boolean; notes?: string }> = {};
  for (const def of PATHOLOGY_DEFS) {
    const present = formData.get(`path_${def.code}`) === "on";
    const notes = String(formData.get(`path_${def.code}_notes`) ?? "").trim();
    pathologies[def.code] = notes ? { present, notes } : { present };
  }

  const names = formData.getAll("medName").map(String);
  const doses = formData.getAll("medDose").map(String);
  const frequencies = formData.getAll("medFrequency").map(String);
  const comments = formData.getAll("medComment").map(String);
  const medications = names
    .map((name, index) => ({
      name: name.trim(),
      dose: (doses[index] ?? "").trim(),
      frequency: (frequencies[index] ?? "").trim(),
      comment: (comments[index] ?? "").trim(),
    }))
    .filter((entry) => entry.name.length > 0);

  return updateMedicalProfileSchema.safeParse({
    pathologies,
    medications,
    allergies: formData.get("allergies"),
    pastSurgeries: formData.get("pastSurgeries"),
    treatingPhysician: formData.get("treatingPhysician"),
    riskNotes: formData.get("riskNotes"),
    isPregnant: formData.get("isPregnant"),
    isSmoker: formData.get("isSmoker"),
    alcoholUse: formData.get("alcoholUse"),
    onAnticoagulants: formData.get("onAnticoagulants"),
    onAntiplatelets: formData.get("onAntiplatelets"),
  });
}

export const addAlertSchema = z.object({
  type: z.enum(["allergy", "medication", "condition", "other"]),
  label: z.string().trim().min(1, "Le libellé est requis").max(200),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
});
