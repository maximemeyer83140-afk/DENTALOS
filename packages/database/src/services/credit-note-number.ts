import type { Prisma } from "@prisma/client";

/** Same pattern as the other numbering services — must run inside the creating transaction. */
export async function nextCreditNoteNumber(tx: Prisma.TransactionClient, clinicId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const countThisYear = await tx.creditNote.count({
    where: { clinicId, creditNoteNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(countThisYear + 1).padStart(4, "0")}`;
}
