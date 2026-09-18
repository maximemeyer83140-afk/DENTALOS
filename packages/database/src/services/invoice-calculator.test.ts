import { describe, expect, it } from "vitest";

import { calculateBalance, calculateInvoiceTotals } from "./invoice-calculator";

describe("calculateInvoiceTotals", () => {
  it("sums quantity * unitPrice across lines", () => {
    const totals = calculateInvoiceTotals([
      { quantity: 2, unitPrice: 40 },
      { quantity: 1, unitPrice: 15.5 },
    ]);
    expect(totals.subtotal).toBe(95.5);
    expect(totals.taxTotal).toBe(0);
    expect(totals.total).toBe(95.5);
  });

  it("rounds to the nearest cent", () => {
    const totals = calculateInvoiceTotals([{ quantity: 3, unitPrice: 10.005 }]);
    expect(totals.total).toBe(30.02);
  });

  it("returns zero totals for no lines", () => {
    expect(calculateInvoiceTotals([])).toEqual({ subtotal: 0, taxTotal: 0, total: 0 });
  });
});

describe("calculateBalance", () => {
  it("subtracts the amount paid from the total", () => {
    expect(calculateBalance(100, 40)).toBe(60);
  });

  it("never goes negative when overpaid", () => {
    expect(calculateBalance(100, 150)).toBe(0);
  });
});
