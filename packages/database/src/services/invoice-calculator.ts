/**
 * The only place invoice totals and balances are computed (section 79: never duplicate a
 * financial formula across the frontend). Distinct from quote-calculator.ts on purpose — an
 * invoice's balance depends on payments, which a quote never has.
 */
export interface InvoiceLineInput {
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;
  taxTotal: number;
  total: number;
}

export function calculateInvoiceTotals(lines: InvoiceLineInput[]): InvoiceTotals {
  const subtotal = lines.reduce((sum, line) => sum + roundChf(line.quantity * line.unitPrice), 0);
  const taxTotal = 0; // Most Swiss dental care is VAT-exempt; see quote-calculator.ts's note.
  return { subtotal: roundChf(subtotal), taxTotal, total: roundChf(subtotal + taxTotal) };
}

export function calculateBalance(total: number, amountPaid: number): number {
  return roundChf(Math.max(0, total - amountPaid));
}

function roundChf(amount: number): number {
  return Math.round(amount * 100) / 100;
}
