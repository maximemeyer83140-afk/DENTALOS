import { Prisma, type Quote, type QuoteStatus } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import { calculateQuoteTotals } from "../services/quote-calculator";
import { nextQuoteNumber } from "../services/quote-number";
import type { TenantContext } from "../tenant-context";

const MAX_CREATE_ATTEMPTS = 3;

export type QuoteWithItems = Prisma.QuoteGetPayload<{ include: { items: true } }>;

/**
 * Copies a treatment plan option's items into a new quote (section 11: devis professionnel), and
 * computes its totals with the one sanctioned calculator (quote-calculator.ts) — never
 * recalculated ad hoc in the UI.
 */
export async function createQuoteFromPlanOption(
  ctx: TenantContext,
  treatmentPlanOptionId: string,
  validUntil: Date | undefined,
  createdBy: string,
): Promise<QuoteWithItems> {
  const option = await prisma.treatmentPlanOption.findFirst({
    where: {
      id: treatmentPlanOptionId,
      treatmentPlan: { organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    },
    include: { items: true, treatmentPlan: true },
  });
  if (!option) throw new NotFoundError(`Treatment plan option ${treatmentPlanOptionId} not found`);
  if (option.items.length === 0) {
    throw new Error("Cannot create a quote from a treatment plan option with no items");
  }

  const totals = calculateQuoteTotals(
    option.items.map((item) => ({ quantity: item.quantity, unitPrice: Number(item.unitPrice) })),
  );

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const quoteNumber = await nextQuoteNumber(tx, ctx.clinicId);
          return tx.quote.create({
            data: {
              organizationId: ctx.organizationId,
              clinicId: ctx.clinicId,
              patientId: option.treatmentPlan.patientId,
              practitionerId: option.treatmentPlan.practitionerId,
              treatmentPlanId: option.treatmentPlan.id,
              quoteNumber,
              validUntil,
              subtotal: totals.subtotal,
              taxTotal: totals.taxTotal,
              total: totals.total,
              createdBy,
              items: {
                create: option.items.map((item) => ({
                  description: item.description,
                  toothNumber: item.toothNumber,
                  tariffItemId: item.tariffItemId,
                  // Traces this quote line back to the plan item it was built from (ÉTAPE 6) —
                  // without it, an invoice created from this quote later has no way to find the
                  // Treatment (if any) that was actually performed for it.
                  treatmentPlanItemId: item.id,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: Number(item.unitPrice) * item.quantity,
                })),
              },
            },
            include: { items: true },
          });
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
  throw new Error("createQuoteFromPlanOption: exhausted retry attempts without a definitive result");
}

export async function listQuotesForPatient(ctx: TenantContext, patientId: string): Promise<Quote[]> {
  return prisma.quote.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateQuoteStatus(ctx: TenantContext, quoteId: string, status: QuoteStatus): Promise<Quote> {
  const result = await prisma.quote.updateMany({
    where: { id: quoteId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: { status },
  });
  if (result.count === 0) throw new NotFoundError(`Quote ${quoteId} not found`);
  const quote = await prisma.quote.findFirst({ where: { id: quoteId } });
  if (!quote) throw new NotFoundError(`Quote ${quoteId} not found`);
  return quote;
}
