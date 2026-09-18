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

const optionalToothNumber = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().min(11).max(48).optional(),
);

export const treatmentPlanLineSchema = z.object({
  tariffItemId: z.string().trim().min(1, "Sélectionne un acte"),
  toothNumber: optionalToothNumber,
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});

export type TreatmentPlanLineInput = z.infer<typeof treatmentPlanLineSchema>;

/**
 * The form serializes its dynamic line-item rows as a single JSON field (`linesJson`) rather than
 * indexed FormData keys — there's no framework helper for parsing `items[0].tariffItemId`-style
 * names server-side here, and JSON keeps the client and server schemas identical.
 */
export const createTreatmentPlanSchema = z
  .object({
    practitionerId: z.string().trim().min(1, "Le praticien est requis"),
    optionLabel: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(120).optional(),
    ),
    linesJson: z.string().min(1),
  })
  .transform((data, ctx) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(data.linesJson);
    } catch {
      ctx.addIssue({ code: "custom", message: "Lignes invalides" });
      return z.NEVER;
    }
    const lines = z.array(treatmentPlanLineSchema).min(1, "Ajoute au moins une ligne").safeParse(parsedJson);
    if (!lines.success) {
      ctx.addIssue({ code: "custom", message: lines.error.issues[0]?.message ?? "Lignes invalides" });
      return z.NEVER;
    }
    return { practitionerId: data.practitionerId, optionLabel: data.optionLabel, lines: lines.data };
  });
