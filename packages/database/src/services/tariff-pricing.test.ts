import type { TariffItem } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeTariffItemPrice } from "./tariff-pricing";

type PriceInput = Pick<TariffItem, "points" | "pointValue" | "computedPrice">;

/** Builds a fake tariff item for pricing tests — plain numbers stand in for Prisma's `Decimal`,
 * which is fine here since `computeTariffItemPrice` only ever calls `Number(...)` on these fields
 * (the same pattern used throughout the invoice/payment code for real Decimal values). */
function fake(points: number | null, pointValue: number | null, computedPrice: number | null): PriceInput {
  return { points, pointValue, computedPrice } as unknown as PriceInput;
}

describe("computeTariffItemPrice", () => {
  it("prefers a flat computedPrice when set", () => {
    expect(computeTariffItemPrice(fake(20, 1, 55))).toBe(55);
  });

  it("computes points × pointValue when no flat price is set", () => {
    expect(computeTariffItemPrice(fake(14, 1.2, null))).toBeCloseTo(16.8, 2);
  });

  it("throws when neither a flat price nor points/pointValue are available", () => {
    expect(() => computeTariffItemPrice(fake(null, null, null))).toThrow();
  });

  it("rounds to the nearest cent", () => {
    expect(computeTariffItemPrice(fake(3, 3.333, null))).toBe(10.0);
  });
});
