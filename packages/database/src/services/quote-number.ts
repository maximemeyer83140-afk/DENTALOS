import type { Prisma } from "@prisma/client";

/** Same pattern as `nextPatientNumber` — must run inside the transaction that creates the Quote. */
export async function nextQuoteNumber(tx: Prisma.TransactionClient, clinicId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const countThisYear = await tx.quote.count({
    where: { clinicId, quoteNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(countThisYear + 1).padStart(4, "0")}`;
}
