import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const inventoryCategorySchema = z.enum([
  "composites",
  "adhesives",
  "anesthetics",
  "needles",
  "gloves",
  "masks",
  "burs",
  "implants",
  "sutures",
  "disinfection",
  "consumables",
  "laboratory",
  "other",
]);

const decimalString = z.coerce.number().positive("La quantité doit être positive.");

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(200),
  contactName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email().optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  paymentTerms: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
});

export const createInventoryItemSchema = z.object({
  sku: z.string().trim().min(1, "La référence (SKU) est obligatoire.").max(50),
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(200),
  category: inventoryCategorySchema,
  supplierId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  unit: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  costPrice: z.coerce.number().min(0, "Le prix d'achat doit être positif ou nul."),
  salePrice: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  reorderThreshold: z.coerce.number().int().min(0).default(0),
  locationLabel: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
});

export const receiveStockSchema = z.object({
  quantity: decimalString,
  lotNumber: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  expiresAt: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const consumeStockSchema = z.object({
  quantity: decimalString,
  reason: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
});

export const adjustStockSchema = z.object({
  delta: z.coerce.number().refine((v) => v !== 0, "L'ajustement ne peut pas être nul."),
  reason: z.string().trim().min(1, "Le motif est obligatoire.").max(300),
});
