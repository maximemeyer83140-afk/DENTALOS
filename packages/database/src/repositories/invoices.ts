import { Prisma, type Invoice } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import { calculateBalance, calculateInvoiceTotals } from "../services/invoice-calculator";
import { nextInvoiceNumber } from "../services/invoice-number";
import type { TenantContext } from "../tenant-context";

const MAX_CREATE_ATTEMPTS = 3;

export class InvoiceNotEditableError extends Error {
  constructor(invoiceId: string, status: string) {
    super(`Invoice ${invoiceId} is not editable in status "${status}" — only draft invoices can change`);
    this.name = "InvoiceNotEditableError";
  }
}

export type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true } }>;

export async function getInvoice(ctx: TenantContext, invoiceId: string): Promise<InvoiceWithItems> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: { items: true },
  });
  if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);
  return invoice;
}

export async function listInvoicesForPatient(ctx: TenantContext, patientId: string): Promise<Invoice[]> {
  return prisma.invoice.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { createdAt: "desc" },
  });
}

/** Copies an accepted quote's lines into a new draft invoice (section 13). The quote's own totals
 * were already computed by quote-calculator.ts from the same lines, so they're copied rather than
 * recomputed — recomputing would just re-derive an identical result from the same inputs. */
export async function createInvoiceFromQuote(
  ctx: TenantContext,
  quoteId: string,
  dueDate: Date | undefined,
  createdBy: string,
): Promise<InvoiceWithItems> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    include: { items: true },
  });
  if (!quote) throw new NotFoundError(`Quote ${quoteId} not found`);
  if (quote.items.length === 0) throw new Error("Cannot invoice a quote with no items");

  const treatmentPlanItemIds = quote.items
    .map((item) => item.treatmentPlanItemId)
    .filter((itemId): itemId is string => itemId !== null);
  // ÉTAPE 6 : quand l'acte a déjà été réalisé (un Treatment existe pour la ligne de plan
  // correspondante), la facture qui en découle pointe dessus — sinon la ligne facturée n'a aucun
  // moyen de retrouver l'acte qu'elle facture, exactement la « duplication incohérente entre
  // traitement, facture et paiement » que le cahier des charges demande d'éviter.
  const treatments =
    treatmentPlanItemIds.length > 0
      ? await prisma.treatment.findMany({ where: { treatmentPlanItemId: { in: treatmentPlanItemIds } } })
      : [];
  const treatmentIdByPlanItemId = new Map(
    treatments
      .filter((t) => t.treatmentPlanItemId !== null)
      .map((t) => [t.treatmentPlanItemId as string, t.id]),
  );

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const invoiceNumber = await nextInvoiceNumber(tx, ctx.clinicId);
          return tx.invoice.create({
            data: {
              organizationId: ctx.organizationId,
              clinicId: ctx.clinicId,
              patientId: quote.patientId,
              practitionerId: quote.practitionerId,
              invoiceNumber,
              dueDate,
              subtotal: quote.subtotal,
              taxTotal: quote.taxTotal,
              total: quote.total,
              amountPaid: 0,
              balance: quote.total,
              createdBy,
              items: {
                create: quote.items.map((item) => ({
                  description: item.description,
                  toothNumber: item.toothNumber,
                  tariffItemId: item.tariffItemId,
                  treatmentId: item.treatmentPlanItemId
                    ? treatmentIdByPlanItemId.get(item.treatmentPlanItemId)
                    : undefined,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
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
  throw new Error("createInvoiceFromQuote: exhausted retry attempts without a definitive result");
}

/** Only a draft can be edited; the schema's own workflow (section 13) forbids changing an issued
 * invoice — enforced here, not just hidden in the UI. */
export async function addInvoiceItem(
  ctx: TenantContext,
  invoiceId: string,
  item: { description: string; quantity: number; unitPrice: number; toothNumber?: number | undefined },
): Promise<InvoiceWithItems> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);
    if (invoice.status !== "draft") throw new InvoiceNotEditableError(invoiceId, invoice.status);

    await tx.invoiceItem.create({
      data: {
        invoiceId,
        description: item.description,
        toothNumber: item.toothNumber,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      },
    });

    const allItems = [...invoice.items, { quantity: item.quantity, unitPrice: item.unitPrice }];
    const totals = calculateInvoiceTotals(
      allItems.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
    );

    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        balance: calculateBalance(totals.total, Number(invoice.amountPaid)),
      },
      include: { items: true },
    });
  });
}

export async function validateInvoice(ctx: TenantContext, invoiceId: string, validatedBy: string): Promise<Invoice> {
  const result = await prisma.invoice.updateMany({
    where: { id: invoiceId, organizationId: ctx.organizationId, clinicId: ctx.clinicId, status: "draft" },
    data: { status: "issued", issueDate: new Date(), validatedAt: new Date(), validatedBy },
  });
  if (result.count === 0) {
    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    });
    if (!existing) throw new NotFoundError(`Invoice ${invoiceId} not found`);
    throw new InvoiceNotEditableError(invoiceId, existing.status);
  }
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);
  return invoice;
}
