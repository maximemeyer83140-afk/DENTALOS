import { Prisma, type CreditNote } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import { nextCreditNoteNumber } from "../services/credit-note-number";
import type { TenantContext } from "../tenant-context";

const MAX_CREATE_ATTEMPTS = 3;

/** Section 13: a validated invoice is never edited directly — a wrong or disputed amount is
 * corrected with a credit note, which reduces the balance due without touching the original
 * invoice's own lines. Only allowed on an invoice that was actually issued (a draft has nothing
 * to credit yet; a cancelled one shouldn't accrue a balance change at all). */
export async function createCreditNote(
  ctx: TenantContext,
  invoiceId: string,
  amount: number,
  reason: string | undefined,
  createdBy: string,
): Promise<CreditNote> {
  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const invoice = await tx.invoice.findFirst({
            where: { id: invoiceId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
          });
          if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);
          if (invoice.status === "draft" || invoice.status === "cancelled") {
            throw new Error(`Cannot credit an invoice in status "${invoice.status}"`);
          }
          if (amount > Number(invoice.balance) + 0.001) {
            throw new Error(`Credit amount ${amount} exceeds the invoice's outstanding balance of ${invoice.balance}`);
          }

          const creditNoteNumber = await nextCreditNoteNumber(tx, ctx.clinicId);
          const creditNote = await tx.creditNote.create({
            data: {
              organizationId: ctx.organizationId,
              clinicId: ctx.clinicId,
              invoiceId,
              creditNoteNumber,
              amount,
              reason,
              createdBy,
            },
          });

          const newBalance = Math.max(0, Number(invoice.balance) - amount);
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { balance: newBalance, status: newBalance <= 0 ? "credited" : invoice.status },
          });

          return creditNote;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const isRetryableConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002");
      if (!isRetryableConflict || attempt === MAX_CREATE_ATTEMPTS) throw error;
    }
  }
  throw new Error("createCreditNote: exhausted retry attempts without a definitive result");
}

export async function listCreditNotesForInvoice(ctx: TenantContext, invoiceId: string): Promise<CreditNote[]> {
  return prisma.creditNote.findMany({
    where: { invoiceId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { issueDate: "desc" },
  });
}
