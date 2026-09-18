import type { TariffItem } from "@prisma/client";

/**
 * The only place a `TariffItem`'s CHF price is derived (section 79). Mirrors how the Swiss
 * point-based dental tariffs actually work (SSO/DENTOTAR, AA/AM/AI): most positions carry a point
 * count, multiplied by a point value that a clinic (or, for AA/AM/AI, the federal agreement) sets —
 * never a price baked into the position itself. A minority of positions (lab pass-through costs,
 * material surcharges) are instead entered as a flat `computedPrice`, which wins when present.
 */
export function computeTariffItemPrice(
  item: Pick<TariffItem, "points" | "pointValue" | "computedPrice">,
): number {
  if (item.computedPrice != null) return roundChf(Number(item.computedPrice));
  if (item.points != null && item.pointValue != null) {
    return roundChf(Number(item.points) * Number(item.pointValue));
  }
  throw new Error(
    "Tariff item has neither a flat computedPrice nor points × pointValue — manual pricing required",
  );
}

function roundChf(amount: number): number {
  return Math.round(amount * 100) / 100;
}
