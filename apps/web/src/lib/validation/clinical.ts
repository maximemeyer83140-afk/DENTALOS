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
  privatePoints: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().positive().optional(),
  ),
});

export type TreatmentPlanLineInput = z.infer<typeof treatmentPlanLineSchema>;

/** "quote" builds a proposal (Devis — items start "planned", can later become a Quote). "treatment"
 * records acts actually performed today (Traitement — items start "completed"). */
export const treatmentPlanModeSchema = z.enum(["quote", "treatment"]);

/**
 * The form serializes its dynamic line-item rows as a single JSON field (`linesJson`) rather than
 * indexed FormData keys — there's no framework helper for parsing `items[0].tariffItemId`-style
 * names server-side here, and JSON keeps the client and server schemas identical.
 */
export const createTreatmentPlanSchema = z
  .object({
    mode: treatmentPlanModeSchema,
    practitionerId: z.string().trim().min(1, "Le praticien est requis"),
    optionLabel: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(120).optional(),
    ),
    regime: z.enum(["AAI", "PRIVATE"]),
    pointValue: z.coerce.number().positive().max(10),
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
    return {
      mode: data.mode,
      practitionerId: data.practitionerId,
      optionLabel: data.optionLabel,
      regime: data.regime,
      pointValue: data.pointValue,
      lines: lines.data,
    };
  });

/** Une ordonnance, comme le plan de traitement ci-dessus, sérialise ses lignes dynamiques
 * (médicaments) en JSON plutôt qu'en champs FormData indexés — même raison : pas d'aide framework
 * pour `items[0].medication` côté serveur ici, et le JSON garde les schémas client/serveur
 * identiques. */
export const prescriptionLineSchema = z.object({
  medication: z.string().trim().min(1, "Le médicament est requis").max(200),
  dosage: z.string().trim().min(1, "La posologie est requise").max(120),
  duration: z.string().trim().min(1, "La durée est requise").max(60),
});

function parsePrescriptionLines(linesJson: string, ctx: z.RefinementCtx): z.infer<typeof prescriptionLineSchema>[] {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(linesJson);
  } catch {
    ctx.addIssue({ code: "custom", message: "Lignes invalides" });
    return z.NEVER;
  }
  const lines = z.array(prescriptionLineSchema).min(1, "Ajoute au moins un médicament").safeParse(parsedJson);
  if (!lines.success) {
    ctx.addIssue({ code: "custom", message: lines.error.issues[0]?.message ?? "Lignes invalides" });
    return z.NEVER;
  }
  return lines.data;
}

export const createPrescriptionSchema = z
  .object({
    practitionerId: z.string().trim().min(1, "Le praticien est requis"),
    notes: optionalText(2000),
    linesJson: z.string().min(1),
  })
  .transform((data, ctx) => ({
    practitionerId: data.practitionerId,
    notes: data.notes,
    items: parsePrescriptionLines(data.linesJson, ctx),
  }));

export const updatePrescriptionSchema = z
  .object({
    notes: optionalText(2000),
    linesJson: z.string().min(1),
  })
  .transform((data, ctx) => ({
    notes: data.notes,
    items: parsePrescriptionLines(data.linesJson, ctx),
  }));
