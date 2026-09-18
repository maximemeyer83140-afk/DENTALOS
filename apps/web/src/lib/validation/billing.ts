import { z } from "zod";

export const recordPaymentSchema = z.object({
  invoiceId: z.string().trim().min(1, "La facture est requise"),
  amount: z.coerce.number().positive("Le montant doit être positif"),
  method: z.enum(["cash", "card", "twint", "bank_transfer", "qr_bill", "other"]),
  reference: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(120).optional(),
  ),
});
