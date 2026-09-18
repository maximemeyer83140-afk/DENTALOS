import type { TariffItem } from "@prisma/client";

/** Which side of the Swiss dental tariff a line is billed under (section 79: the regime, and the
 * point value it implies, always come from the caller — never hardcoded, never read off the item
 * alone). "AAI" = AA/AM/AI (accident/military/invalidity insurance), point value fixed nationally
 * at CHF 1.00 since 1 January 2018. "PRIVATE" = DENTOTAR® private-patient billing, point value set
 * by the practice (capped at CHF 1.70 for SSO members). */
export type TariffRegime = "AAI" | "PRIVATE";

export interface PriceTariffItemInput {
  item: Pick<TariffItem, "points" | "pointsPrivateMin" | "pointsPrivateMax" | "computedPrice">;
  regime: TariffRegime;
  /** CHF per point, chosen by the caller for this quote/session — never stored per item. */
  pointValue: number;
  /** When `regime` is "PRIVATE" and the item allows a point range, the point count chosen within
   * that range (case complexity). Defaults to the range's max when omitted. */
  privatePoints?: number | undefined;
}

/**
 * The only place a `TariffItem`'s CHF price is derived. A flat `computedPrice` (lab pass-through
 * costs, material surcharges) always wins when present — regime and point value are irrelevant to
 * those. Otherwise: AAI multiplies the item's fixed point count by the AAI point value; PRIVATE
 * multiplies a chosen point count (within the item's private min/max range) by the practice's own
 * point value.
 */
export function computeTariffItemPrice(input: PriceTariffItemInput): number {
  const { item } = input;
  if (item.computedPrice != null) return roundChf(Number(item.computedPrice));

  if (input.regime === "AAI") {
    if (item.points == null) {
      throw new Error("Tariff item has no AA/AM/AI point count — cannot price under this regime");
    }
    return roundChf(Number(item.points) * input.pointValue);
  }

  const min = item.pointsPrivateMin != null ? Number(item.pointsPrivateMin) : null;
  const max = item.pointsPrivateMax != null ? Number(item.pointsPrivateMax) : null;
  const fallback = item.points != null ? Number(item.points) : null;
  const chosen = input.privatePoints ?? max ?? fallback;
  if (chosen == null) {
    throw new Error("Tariff item has no private point range or point count — cannot price under this regime");
  }
  if (min != null && max != null && (chosen < min || chosen > max)) {
    throw new Error(`Chosen point count ${chosen} is outside the item's private range [${min}, ${max}]`);
  }
  return roundChf(chosen * input.pointValue);
}

function roundChf(amount: number): number {
  return Math.round(amount * 100) / 100;
}
