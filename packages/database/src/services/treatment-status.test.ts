import { describe, expect, it } from "vitest";

import { computeSoinStatus } from "./treatment-status";

/**
 * ÉTAPE 6 : le statut affiché par soin doit se déduire uniquement de la chaîne réelle
 * plan → traitement → facture, jamais d'un indicateur séparé qu'on pourrait oublier de mettre à
 * jour (c'est exactement la "duplication incohérente" que le cahier des charges demande d'éviter).
 */
describe("computeSoinStatus", () => {
  it("is PRÉVU for an item not yet performed, whatever else is linked", () => {
    expect(computeSoinStatus({ itemStatus: "planned", hasTreatment: false, hasInvoiceItem: false })).toBe("planned");
    expect(computeSoinStatus({ itemStatus: "accepted", hasTreatment: false, hasInvoiceItem: false })).toBe("planned");
    expect(computeSoinStatus({ itemStatus: "in_progress", hasTreatment: false, hasInvoiceItem: false })).toBe("planned");
  });

  it("is ANNULÉ for a rejected or cancelled plan item, even if somehow marked completed elsewhere", () => {
    expect(computeSoinStatus({ itemStatus: "rejected", hasTreatment: false, hasInvoiceItem: false })).toBe("cancelled");
    expect(computeSoinStatus({ itemStatus: "cancelled", hasTreatment: true, hasInvoiceItem: true, invoiceStatus: "paid" })).toBe(
      "cancelled",
    );
  });

  it("is RÉALISÉ when completed but not yet linked to a Treatment record", () => {
    expect(computeSoinStatus({ itemStatus: "completed", hasTreatment: false, hasInvoiceItem: false })).toBe("done");
  });

  it("is À FACTURER once a Treatment exists but no invoice line references it", () => {
    expect(computeSoinStatus({ itemStatus: "completed", hasTreatment: true, hasInvoiceItem: false })).toBe("to_invoice");
  });

  it("is FACTURÉ when invoiced but the invoice isn't paid", () => {
    expect(computeSoinStatus({ itemStatus: "completed", hasTreatment: true, hasInvoiceItem: true, invoiceStatus: "issued" })).toBe(
      "invoiced",
    );
    expect(
      computeSoinStatus({ itemStatus: "completed", hasTreatment: true, hasInvoiceItem: true, invoiceStatus: "overdue" }),
    ).toBe("invoiced");
  });

  it("is PAYÉ only once the invoice's own status is paid", () => {
    expect(computeSoinStatus({ itemStatus: "completed", hasTreatment: true, hasInvoiceItem: true, invoiceStatus: "paid" })).toBe(
      "paid",
    );
  });
});
