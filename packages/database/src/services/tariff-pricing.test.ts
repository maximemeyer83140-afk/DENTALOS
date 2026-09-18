import type { TariffItem } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeTariffItemPrice } from "./tariff-pricing";

type PriceInput = Pick<TariffItem, "points" | "pointsPrivateMin" | "pointsPrivateMax" | "computedPrice">;

/** Builds a fake tariff item for pricing tests — plain numbers stand in for Prisma's `Decimal`,
 * which is fine here since `computeTariffItemPrice` only ever calls `Number(...)` on these fields
 * (the same pattern used throughout the invoice/payment code for real Decimal values). */
function fake(
  points: number | null,
  pointsPrivateMin: number | null,
  pointsPrivateMax: number | null,
  computedPrice: number | null,
): PriceInput {
  return { points, pointsPrivateMin, pointsPrivateMax, computedPrice } as unknown as PriceInput;
}

describe("computeTariffItemPrice", () => {
  it("prefers a flat computedPrice regardless of regime", () => {
    const item = fake(20, 15, 25, 55);
    expect(computeTariffItemPrice({ item, regime: "AAI", pointValue: 1 })).toBe(55);
    expect(computeTariffItemPrice({ item, regime: "PRIVATE", pointValue: 1.7 })).toBe(55);
  });

  it("AAI regime multiplies the fixed point count by the given point value", () => {
    const item = fake(14, null, null, null);
    expect(computeTariffItemPrice({ item, regime: "AAI", pointValue: 1 })).toBeCloseTo(14, 2);
  });

  it("AAI regime throws when the item has no AA/AM/AI point count", () => {
    const item = fake(null, 15, 25, null);
    expect(() => computeTariffItemPrice({ item, regime: "AAI", pointValue: 1 })).toThrow();
  });

  it("PRIVATE regime defaults to the range's max point count", () => {
    const item = fake(null, 62.2, 84.2, null);
    expect(computeTariffItemPrice({ item, regime: "PRIVATE", pointValue: 1 })).toBeCloseTo(84.2, 2);
  });

  it("PRIVATE regime accepts a chosen point count within the range", () => {
    const item = fake(null, 62.2, 84.2, null);
    expect(computeTariffItemPrice({ item, regime: "PRIVATE", pointValue: 1, privatePoints: 70 })).toBeCloseTo(70, 2);
  });

  it("PRIVATE regime rejects a chosen point count outside the range", () => {
    const item = fake(null, 62.2, 84.2, null);
    expect(() =>
      computeTariffItemPrice({ item, regime: "PRIVATE", pointValue: 1, privatePoints: 999 }),
    ).toThrow(/outside/);
  });

  it("PRIVATE regime falls back to the fixed point count when no private range exists (e.g. LP+ positions)", () => {
    const item = fake(194.4, null, null, null);
    expect(computeTariffItemPrice({ item, regime: "PRIVATE", pointValue: 1 })).toBeCloseTo(194.4, 2);
  });

  it("throws when nothing usable is available at all", () => {
    const item = fake(null, null, null, null);
    expect(() => computeTariffItemPrice({ item, regime: "AAI", pointValue: 1 })).toThrow();
    expect(() => computeTariffItemPrice({ item, regime: "PRIVATE", pointValue: 1 })).toThrow();
  });

  it("rounds to the nearest cent", () => {
    const item = fake(3, null, null, null);
    expect(computeTariffItemPrice({ item, regime: "AAI", pointValue: 3.333 })).toBe(10.0);
  });
});
