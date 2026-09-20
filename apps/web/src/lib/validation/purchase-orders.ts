import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const purchaseOrderLineSchema = z.object({
  inventoryItemId: z.string().trim().min(1, "Sélectionne un article"),
  quantityOrdered: z.coerce.number().positive("La quantité doit être positive."),
  unitCost: z.coerce.number().min(0, "Le prix doit être positif ou nul."),
});

/** Same convention as `createTreatmentPlanSchema` — the dynamic line-item rows serialize as one
 * JSON field (`linesJson`) rather than indexed FormData keys, so client and server share the same
 * line shape without a bespoke `items[0].x`-style parser. */
export const createPurchaseOrderSchema = z
  .object({
    supplierId: z.string().trim().min(1, "Le fournisseur est obligatoire."),
    expectedAt: z.preprocess(emptyToUndefined, z.string().optional()),
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
    const lines = z.array(purchaseOrderLineSchema).min(1, "Ajoute au moins une ligne").safeParse(parsedJson);
    if (!lines.success) {
      ctx.addIssue({ code: "custom", message: lines.error.issues[0]?.message ?? "Lignes invalides" });
      return z.NEVER;
    }
    return { supplierId: data.supplierId, expectedAt: data.expectedAt, items: lines.data };
  });

export const receiptLineSchema = z.object({
  purchaseOrderItemId: z.string().trim().min(1),
  quantityReceived: z.coerce.number().min(0),
});

export const receivePurchaseOrderItemsSchema = z
  .object({
    linesJson: z.string().min(1),
    lotNumber: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
    expiresAt: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .transform((data, ctx) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(data.linesJson);
    } catch {
      ctx.addIssue({ code: "custom", message: "Lignes invalides" });
      return z.NEVER;
    }
    const lines = z.array(receiptLineSchema).safeParse(parsedJson);
    if (!lines.success) {
      ctx.addIssue({ code: "custom", message: "Lignes invalides" });
      return z.NEVER;
    }
    return { lines: lines.data, lotNumber: data.lotNumber, expiresAt: data.expiresAt };
  });
