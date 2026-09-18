/**
 * The only place quote totals are computed (section 79 of the brief: never duplicate a financial
 * formula across the frontend). `Invoice`/`CompensationStatement` get their own calculators in
 * Phase 5 — this one only knows about quotes.
 */
export interface QuoteLineInput {
  quantity: number;
  unitPrice: number;
}

export interface QuoteTotals {
  subtotal: number;
  taxTotal: number;
  total: number;
}

/** No Swiss dental care VAT is applied by default (most care is exempt); `taxTotal` exists in the
 * schema for the cabinets/cases where it legitimately applies, computed elsewhere once that rule
 * is needed — kept at 0 here rather than guessed. */
export function calculateQuoteTotals(lines: QuoteLineInput[]): QuoteTotals {
  const subtotal = lines.reduce((sum, line) => sum + roundChf(line.quantity * line.unitPrice), 0);
  const taxTotal = 0;
  return { subtotal: roundChf(subtotal), taxTotal, total: roundChf(subtotal + taxTotal) };
}

/** CHF amounts round to 5 cents in Swiss cash-payment convention only when actually paid in cash;
 * for stored/invoiced amounts, 2-decimal rounding is standard practice and what other clinics'
 * billing systems expect. Cash rounding, if needed, happens at payment time (Phase 5), not here. */
function roundChf(amount: number): number {
  return Math.round(amount * 100) / 100;
}
