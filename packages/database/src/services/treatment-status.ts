import type { InvoiceStatus, TreatmentPlanItemStatus } from "@prisma/client";

/**
 * ÉTAPE 6's explicit per-acte status (PRÉVU / RÉALISÉ / À FACTURER / FACTURÉ / PAYÉ), derived
 * purely from the real chain of records — never a separate flag someone has to remember to update,
 * which is exactly how "traitement", "facture" et "paiement" end up incoherent with each other:
 *
 * - `planned`   — the item hasn't been performed yet (TreatmentPlanItemStatus planned/accepted/in_progress).
 * - `done`      — performed, but nothing links it to a Treatment record yet (should only happen for
 *                 data written before this linkage existed — the normal path always creates the
 *                 Treatment in the same transaction that marks the item completed).
 * - `to_invoice`— performed, a Treatment exists, but no invoice line references it yet.
 * - `invoiced`  — a Treatment exists and is on an invoice that isn't (yet, or ever, if cancelled) fully paid.
 * - `paid`      — that invoice's own status is "paid".
 * - `cancelled` — the plan item itself was rejected or cancelled.
 */
export type SoinStatus = "planned" | "done" | "to_invoice" | "invoiced" | "paid" | "cancelled";

export const SOIN_STATUS_LABEL: Record<SoinStatus, string> = {
  planned: "Prévu",
  done: "Réalisé",
  to_invoice: "À facturer",
  invoiced: "Facturé",
  paid: "Payé",
  cancelled: "Annulé",
};

export interface ComputeSoinStatusInput {
  itemStatus: TreatmentPlanItemStatus;
  hasTreatment: boolean;
  hasInvoiceItem: boolean;
  invoiceStatus?: InvoiceStatus | undefined;
}

export function computeSoinStatus(input: ComputeSoinStatusInput): SoinStatus {
  if (input.itemStatus === "cancelled" || input.itemStatus === "rejected") return "cancelled";
  if (input.itemStatus !== "completed") return "planned";
  if (!input.hasTreatment) return "done";
  if (!input.hasInvoiceItem) return "to_invoice";
  return input.invoiceStatus === "paid" ? "paid" : "invoiced";
}
