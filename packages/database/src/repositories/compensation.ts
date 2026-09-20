import type { CompensationModel, CompensationRule, CompensationStatement, CompensationStatementStatus } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export class CompensationStatementNotEditableError extends Error {
  constructor(statementId: string, status: string) {
    super(`Compensation statement ${statementId} cannot be changed in status "${status}"`);
    this.name = "CompensationStatementNotEditableError";
  }
}

/** `hybrid` (and, optionally, `salary`) read their extra numbers from here rather than a second
 * migration — see PHASE_14.md for why: two numbers don't justify new columns, and `config` was
 * already reserved for exactly this in the Phase 0 schema. */
export interface CompensationRuleConfig {
  /** `salary`: the fixed monthly amount. `hybrid`: the guaranteed base on top of the percentage. */
  fixedAmount?: number;
  /** `hybrid` only: the rate only applies to the base amount *above* this threshold. */
  thresholdAmount?: number;
}

export interface SetCompensationRuleInput {
  model: CompensationModel;
  /** Fraction, not a percentage — `0.40` means 40%. Required for every model except `salary`. */
  rate?: number | undefined;
  config?: CompensationRuleConfig | undefined;
  validFrom: Date;
}

/** A practitioner's whole rétrocession history — most recent first. Never edited in place: see
 * `setCompensationRule`. */
export async function listCompensationRules(ctx: TenantContext, practitionerId: string): Promise<CompensationRule[]> {
  return prisma.compensationRule.findMany({
    where: { practitionerId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { validFrom: "desc" },
  });
}

/** The rule in effect on a given date — `validFrom <= date < validTo` (or `validTo` is still
 * null, meaning "still open"). Never two rules overlap for the same practitioner (see
 * `setCompensationRule`), so at most one row ever matches. */
export async function getActiveCompensationRule(
  ctx: TenantContext,
  practitionerId: string,
  atDate: Date = new Date(),
): Promise<CompensationRule | null> {
  return prisma.compensationRule.findFirst({
    where: {
      practitionerId,
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      validFrom: { lte: atDate },
      OR: [{ validTo: null }, { validTo: { gt: atDate } }],
    },
  });
}

/**
 * Setting a new rate never edits the old one in place — a rétrocession history ("40% jusqu'en
 * mars, 45% depuis") is exactly what makes a compensation statement's `rateApplied` explainable
 * months later. Instead this closes whatever rule was still open (`validTo: null`) exactly at the
 * new rule's `validFrom`, then creates the new one — the two intervals meet with no gap and no
 * overlap.
 */
export async function setCompensationRule(
  ctx: TenantContext,
  practitionerId: string,
  input: SetCompensationRuleInput,
  createdBy: string,
): Promise<CompensationRule> {
  const practitioner = await prisma.practitioner.findFirst({
    where: { id: practitionerId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!practitioner) throw new NotFoundError(`Practitioner ${practitionerId} not found`);
  if (input.model !== "salary" && input.rate === undefined) {
    throw new Error(`A rate is required for compensation model "${input.model}"`);
  }

  const openRule = await prisma.compensationRule.findFirst({
    where: { practitionerId, organizationId: ctx.organizationId, clinicId: ctx.clinicId, validTo: null },
  });
  if (openRule && input.validFrom <= openRule.validFrom) {
    throw new Error(
      `The new rate must start after the current rule's start date (${openRule.validFrom.toISOString().slice(0, 10)}) — backdating would corrupt the rate history`,
    );
  }

  return prisma.$transaction(async (tx) => {
    if (openRule) {
      await tx.compensationRule.update({ where: { id: openRule.id }, data: { validTo: input.validFrom } });
    }
    return tx.compensationRule.create({
      data: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        practitionerId,
        model: input.model,
        rate: input.rate,
        config: input.config,
        validFrom: input.validFrom,
        createdBy,
      },
    });
  });
}

export interface CaBreakdown {
  /** Actes réalisés (`Treatment`, statut `completed`) valorisés au tarif appliqué — le chiffre
   * d'affaires "produit" par le praticien, qu'il ait été facturé ou non. */
  production: number;
  /** Total facturé (`Invoice.total`, hors brouillons et factures annulées) émis dans la période. */
  billed: number;
  /** Total réellement encaissé (`PaymentAllocation` vers une facture de ce praticien, paiement
   * complété) dans la période. */
  collected: number;
  /** Avoirs émis dans la période sur des factures de ce praticien. */
  creditNotes: number;
}

/** Read-only preview of a practitioner's CA over a period — no `CompensationStatement` row is
 * created. Used by the overview dashboard to show "CA du mois en cours" before an admin actually
 * generates (and thereby locks in) a decompte for a closed period. */
export async function computeCaBreakdown(
  ctx: TenantContext,
  practitionerId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<CaBreakdown> {
  const [treatments, billedAgg, allocations, creditNotesAgg] = await Promise.all([
    prisma.treatment.findMany({
      where: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        practitionerId,
        status: "completed",
        performedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { unitPrice: true, quantity: true },
    }),
    prisma.invoice.aggregate({
      where: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        practitionerId,
        status: { notIn: ["draft", "cancelled"] },
        issueDate: { gte: periodStart, lte: periodEnd },
      },
      _sum: { total: true },
    }),
    prisma.paymentAllocation.findMany({
      where: {
        invoice: { organizationId: ctx.organizationId, clinicId: ctx.clinicId, practitionerId },
        payment: { status: "completed", paidAt: { gte: periodStart, lte: periodEnd } },
      },
      select: { amount: true },
    }),
    prisma.creditNote.aggregate({
      where: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        invoice: { practitionerId },
        issueDate: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    production: treatments.reduce((sum, t) => sum + Number(t.unitPrice) * t.quantity, 0),
    billed: Number(billedAgg._sum.total ?? 0),
    collected: allocations.reduce((sum, a) => sum + Number(a.amount), 0),
    creditNotes: Number(creditNotesAgg._sum.amount ?? 0),
  };
}

/** Applies a rule's model to a CA breakdown, returning the base the rate is applied on and the
 * resulting gross amount — pure and independently testable from the (heavier) CA aggregation. */
export function applyCompensationModel(
  model: CompensationModel,
  rate: number | null,
  config: CompensationRuleConfig | null,
  ca: CaBreakdown,
): { baseAmount: number; computedAmount: number } {
  const fixedAmount = config?.fixedAmount ?? 0;
  const thresholdAmount = config?.thresholdAmount ?? 0;

  switch (model) {
    case "salary":
      return { baseAmount: 0, computedAmount: fixedAmount };
    case "percentage_production":
      return { baseAmount: ca.production, computedAmount: ca.production * (rate ?? 0) };
    case "percentage_collected":
      return { baseAmount: ca.collected, computedAmount: ca.collected * (rate ?? 0) };
    case "percentage_revenue": {
      const base = ca.billed - ca.creditNotes;
      return { baseAmount: base, computedAmount: base * (rate ?? 0) };
    }
    case "hybrid": {
      const base = ca.billed - ca.creditNotes;
      const excess = Math.max(0, base - thresholdAmount);
      return { baseAmount: base, computedAmount: fixedAmount + excess * (rate ?? 0) };
    }
    default:
      throw new Error(`Unknown compensation model: ${model as string}`);
  }
}

/**
 * Generates a decompte for one practitioner over one period — the rate applied is whichever rule
 * was active on `periodStart` (a rate change mid-period is not pro-rated; see PHASE_14.md for why
 * that's a deliberate, documented simplification). Always created `draft`: nothing is final until
 * `validateStatement` confirms it.
 */
export async function generateCompensationStatement(
  ctx: TenantContext,
  practitionerId: string,
  periodStart: Date,
  periodEnd: Date,
  createdBy: string,
): Promise<CompensationStatement> {
  const practitioner = await prisma.practitioner.findFirst({
    where: { id: practitionerId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!practitioner) throw new NotFoundError(`Practitioner ${practitionerId} not found`);

  const rule = await getActiveCompensationRule(ctx, practitionerId, periodStart);
  if (!rule) throw new Error(`No compensation rule is active for this practitioner on ${periodStart.toISOString().slice(0, 10)}`);

  const ca = await computeCaBreakdown(ctx, practitionerId, periodStart, periodEnd);
  const config = rule.config as CompensationRuleConfig | null;
  const rate = rule.rate !== null ? Number(rule.rate) : null;
  const { baseAmount, computedAmount } = applyCompensationModel(rule.model, rate, config, ca);

  return prisma.compensationStatement.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      practitionerId,
      periodStart,
      periodEnd,
      production: ca.production,
      billed: ca.billed,
      collected: ca.collected,
      creditNotes: ca.creditNotes,
      baseAmount,
      rateApplied: rate ?? 0,
      computedAmount,
      adjustments: 0,
      finalAmount: computedAmount,
      generatedBy: createdBy,
    },
  });
}

export interface ListCompensationStatementsOptions {
  practitionerId?: string | undefined;
}

export async function listCompensationStatements(
  ctx: TenantContext,
  options: ListCompensationStatementsOptions = {},
): Promise<CompensationStatement[]> {
  return prisma.compensationStatement.findMany({
    where: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      ...(options.practitionerId ? { practitionerId: options.practitionerId } : {}),
    },
    orderBy: { periodStart: "desc" },
  });
}

/** A manual correction (ex. reprise d'une erreur du mois précédent) — only while `draft`, exactly
 * like every other "immutable once issued" document in this codebase (invoices, credit notes). */
export async function setStatementAdjustment(
  ctx: TenantContext,
  statementId: string,
  adjustments: number,
  notes: string | undefined,
): Promise<CompensationStatement> {
  const statement = await prisma.compensationStatement.findFirst({
    where: { id: statementId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
  if (!statement) throw new NotFoundError(`Compensation statement ${statementId} not found`);
  if (statement.status !== "draft") throw new CompensationStatementNotEditableError(statementId, statement.status);

  return prisma.compensationStatement.update({
    where: { id: statementId },
    data: { adjustments, notes, finalAmount: Number(statement.computedAmount) + adjustments },
  });
}

async function transitionStatement(
  ctx: TenantContext,
  statementId: string,
  from: CompensationStatementStatus,
  to: CompensationStatementStatus,
): Promise<CompensationStatement> {
  const result = await prisma.compensationStatement.updateMany({
    where: { id: statementId, organizationId: ctx.organizationId, clinicId: ctx.clinicId, status: from },
    data: { status: to },
  });
  if (result.count === 0) {
    const existing = await prisma.compensationStatement.findFirst({
      where: { id: statementId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    });
    if (!existing) throw new NotFoundError(`Compensation statement ${statementId} not found`);
    throw new CompensationStatementNotEditableError(statementId, existing.status);
  }
  return prisma.compensationStatement.findFirstOrThrow({ where: { id: statementId } });
}

export function validateStatement(ctx: TenantContext, statementId: string): Promise<CompensationStatement> {
  return transitionStatement(ctx, statementId, "draft", "validated");
}

export function markStatementPaid(ctx: TenantContext, statementId: string): Promise<CompensationStatement> {
  return transitionStatement(ctx, statementId, "validated", "paid");
}
