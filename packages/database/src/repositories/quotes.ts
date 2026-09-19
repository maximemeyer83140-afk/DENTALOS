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

/** Includes each quote's lines directly — ÉTAPE 7 needs the detail ("traitements, actes, prix
 * détaillés") available without a second round trip per quote, and a patient's quote list is
 * small enough that this never becomes a real payload concern. */
export async function listQuotesForPatient(ctx: TenantContext, patientId: string): Promise<QuoteWithItems[]> {
  return prisma.quote.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * ÉTAPE 7 : accepter ou refuser un devis répercute la décision sur les lignes de plan de
 * traitement dont il vient (via `QuoteItem.treatmentPlanItemId`) — "accepté" fait passer chaque
 * ligne encore "planned" à "accepted" (le geste concret derrière "transformer les actes acceptés
 * en plan de traitement" : les lignes sont déjà des `TreatmentPlanItem`, il n'y a rien de plus à
 * créer, seulement leur statut à faire avancer) ; "refusé" les fait passer à "rejected". Un devis
 * "partiellement accepté" ne cascade rien : sans un accord ligne par ligne, on ne sait pas
 * lesquelles ont été retenues — voir la limitation notée dans PHASE_4.md.
 */
export async function updateQuoteStatus(ctx: TenantContext, quoteId: string, status: QuoteStatus): Promise<Quote> {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findFirst({
      where: { id: quoteId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
      include: { items: true },
    });
    if (!quote) throw new NotFoundError(`Quote ${quoteId} not found`);

    const updated = await tx.quote.update({ where: { id: quoteId }, data: { status } });

    if (status === "accepted" || status === "rejected") {
      const nextItemStatus = status === "accepted" ? "accepted" : "rejected";
      const treatmentPlanItemIds = quote.items
        .map((item) => item.treatmentPlanItemId)
        .filter((itemId): itemId is string => itemId !== null);
      if (treatmentPlanItemIds.length > 0) {
        await tx.treatmentPlanItem.updateMany({
          where: { id: { in: treatmentPlanItemIds }, status: "planned" },
          data: { status: nextItemStatus },
        });
      }
    }

    return updated;
  });
}
