import type { Prisma } from "@prisma/client";

/** Same pattern as `nextPatientNumber`/`nextQuoteNumber` — must run inside the transaction that
 * creates the Invoice. See docs/phases/PHASE_5.md for why numbering happens at draft creation
 * rather than only at validation (a documented, deliberate simplification). */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, clinicId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const countThisYear = await tx.invoice.count({
    where: { clinicId, invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(countThisYear + 1).padStart(4, "0")}`;
}
