import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const compensationModelSchema = z.enum([
  "salary",
  "percentage_revenue",
  "percentage_collected",
  "percentage_production",
  "hybrid",
]);

/** Admin types a percentage (0-100) — stored as a fraction (0-1), consistent with the fraction
 * convention `services/analytics.ts` already uses for `quotes.acceptanceRate`. */
export const setCompensationRuleSchema = z
  .object({
    model: compensationModelSchema,
    ratePercent: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100).optional()),
    fixedAmount: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
    thresholdAmount: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
    validFrom: z.string().min(1, "La date de prise d'effet est obligatoire."),
  })
  .transform((data, ctx) => {
    if (data.model !== "salary" && data.ratePercent === undefined) {
      ctx.addIssue({ code: "custom", message: "Le taux est obligatoire pour ce modèle." });
      return z.NEVER;
    }
    if ((data.model === "salary" || data.model === "hybrid") && data.fixedAmount === undefined) {
      ctx.addIssue({ code: "custom", message: "Le montant fixe est obligatoire pour ce modèle." });
      return z.NEVER;
    }
    return {
      model: data.model,
      rate: data.ratePercent !== undefined ? data.ratePercent / 100 : undefined,
      config:
        data.fixedAmount !== undefined || data.thresholdAmount !== undefined
          ? { fixedAmount: data.fixedAmount, thresholdAmount: data.thresholdAmount }
          : undefined,
      validFrom: data.validFrom,
    };
  });

export const generateStatementSchema = z.object({
  periodStart: z.string().min(1, "La date de début est obligatoire."),
  periodEnd: z.string().min(1, "La date de fin est obligatoire."),
});

export const setStatementAdjustmentSchema = z.object({
  adjustments: z.coerce.number(),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});
