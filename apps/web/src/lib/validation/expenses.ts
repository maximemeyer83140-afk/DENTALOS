import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const expenseCategorySchema = z.enum([
  "rent",
  "salaries",
  "laboratory",
  "equipment",
  "consumables",
  "insurance",
  "software",
  "marketing",
  "telecom",
  "utilities",
  "training",
  "maintenance",
  "accounting",
  "banking",
  "other",
]);

export const createExpenseSchema = z.object({
  category: expenseCategorySchema,
  amount: z.coerce.number().positive("Le montant doit être positif."),
  taxAmount: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  date: z.string().min(1, "La date est obligatoire."),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});

export const createRecurringExpenseSchema = z.object({
  category: expenseCategorySchema,
  label: z.string().trim().min(1, "Le libellé est obligatoire.").max(200),
  amount: z.coerce.number().positive("Le montant doit être positif."),
  intervalUnit: z.enum(["monthly", "quarterly", "yearly"]),
  nextRunAt: z.string().min(1, "La prochaine échéance est obligatoire."),
});
