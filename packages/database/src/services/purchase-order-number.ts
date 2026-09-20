import type { Prisma } from "@prisma/client";

/** Same pattern as `nextInvoiceNumber`/`nextQuoteNumber` — must run inside the transaction that
 * creates the PurchaseOrder. */
export async function nextPurchaseOrderNumber(tx: Prisma.TransactionClient, clinicId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const countThisYear = await tx.purchaseOrder.count({
    where: { clinicId, orderNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(countThisYear + 1).padStart(4, "0")}`;
}
