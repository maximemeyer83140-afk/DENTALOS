/**
 * Swiss QR-bill payload generation (section 14 of the brief).
 *
 * ⚠️ IMPORTANT: this reconstructs the "Swiss Implementation Guidelines QR-bill" (SIX) payload
 * structure and the QRR reference check-digit algorithm from well-established public
 * documentation, written without network access to cross-check the current official
 * specification field-by-field. Before this touches a real invoice sent to a real bank or shown
 * to a real patient: validate every line of `buildSwissQrBillPayload`'s output against the
 * official SIX document in force at deployment time, and test it with a bank's/PostFinance's
 * validation tool. Never presented as certified — see COMPLIANCE.md and docs/phases/PHASE_5.md.
 *
 * This module produces the payload TEXT only (what a QR code encodes) — rendering it as an actual
 * scannable QR image needs a QR-encoding library (e.g. `qrcode`), not yet installable in this
 * environment (see docs/phases/PHASE_0.md). That is a mechanical last step once dependencies can
 * be installed; getting this data structure right is the part that actually requires care.
 */

/**
 * The "Modulo 10 recursive" check-digit table used for Swiss ESR/QRR reference numbers. Row =
 * current carry (0-9), column = next digit (0-9); the cell is the new carry. This exact table is
 * long-standing public Swiss payment-standard material (used for decades on orange payment
 * slips), not something invented here.
 */
const MOD10_TABLE: readonly (readonly number[])[] = [
  [0, 9, 4, 6, 8, 2, 7, 1, 3, 5],
  [9, 4, 6, 8, 2, 7, 1, 3, 5, 0],
  [4, 6, 8, 2, 7, 1, 3, 5, 0, 9],
  [6, 8, 2, 7, 1, 3, 5, 0, 9, 4],
  [8, 2, 7, 1, 3, 5, 0, 9, 4, 6],
  [2, 7, 1, 3, 5, 0, 9, 4, 6, 8],
  [7, 1, 3, 5, 0, 9, 4, 6, 8, 2],
  [1, 3, 5, 0, 9, 4, 6, 8, 2, 7],
  [3, 5, 0, 9, 4, 6, 8, 2, 7, 1],
  [5, 0, 9, 4, 6, 8, 2, 7, 1, 3],
];

/** Computes the Modulo-10-recursive check digit for a string of digits (the 26-digit body of a
 * QRR reference, before its trailing check digit). */
export function computeMod10CheckDigit(digits: string): number {
  if (!/^\d+$/.test(digits)) throw new Error("computeMod10CheckDigit expects a digit-only string");
  let carry = 0;
  for (const char of digits) {
    const digit = Number(char);
    const row = MOD10_TABLE[carry];
    if (!row) throw new Error("Unreachable: carry is always 0-9");
    carry = row[digit]!;
  }
  return (10 - carry) % 10;
}

/** Builds a 27-digit QRR reference from a biller-chosen numeric id (e.g. the invoice's own
 * sequence number with the clinic's dashes stripped), zero-padded to 26 digits, plus its check
 * digit. */
export function buildQrrReference(rawId: string): string {
  const digitsOnly = rawId.replace(/\D/g, "");
  if (digitsOnly.length === 0 || digitsOnly.length > 26) {
    throw new Error("QRR reference source must contain 1-26 digits");
  }
  const body = digitsOnly.padStart(26, "0");
  const checkDigit = computeMod10CheckDigit(body);
  return `${body}${checkDigit}`;
}

/** Recomputes the check digit over all 27 digits (body + check digit): valid iff the resulting
 * carry is 0. Self-consistency check, independent of `buildQrrReference` — used to catch a
 * transcription error in a reference before it ever reaches a bank. */
export function verifyQrrReference(reference: string): boolean {
  if (!/^\d{27}$/.test(reference)) return false;
  let carry = 0;
  for (const char of reference) {
    const digit = Number(char);
    const row = MOD10_TABLE[carry];
    if (!row) return false;
    carry = row[digit]!;
  }
  return carry === 0;
}

/** Reference formatted with a space every 5 digits from the right, as shown to humans on the
 * printed slip (the raw, unspaced string is what actually goes in the QR payload). */
export function formatQrrReferenceForDisplay(reference: string): string {
  return reference.replace(/(\d)(?=(\d{5})+(?!\d))/g, "$1 ");
}

export interface QrBillAddress {
  name: string;
  addressLine1: string;
  addressLine2?: string | undefined;
  postalCode: string;
  city: string;
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "CH"
}

export interface QrBillInput {
  creditorIban: string; // IBAN or QR-IBAN
  creditor: QrBillAddress;
  debtor?: QrBillAddress | undefined;
  amount: number; // omit (pass undefined) for an amount the payer fills in themselves
  currency: "CHF" | "EUR";
  qrrReference?: string | undefined; // set when creditorIban is a QR-IBAN
  unstructuredMessage?: string | undefined;
  billingInformation?: string | undefined; // Swico S1 structured line, optional
}

const EOL = "\r\n"; // The spec mandates CRLF line endings.

/**
 * Builds the raw QR-bill payload text, field order per the SIX specification's structure (Header,
 * CdtrInf, UltmtCdtr — deprecated/empty since v2.2, CcyAmt, UltmtDbtr, RmtInf, trailer).
 */
export function buildSwissQrBillPayload(input: QrBillInput): string {
  const referenceType = input.qrrReference ? "QRR" : "NON";
  const lines: string[] = [
    "SPC", // QRType
    "0200", // Version
    "1", // Coding type: UTF-8

    // CdtrInf — creditor
    input.creditorIban.replace(/\s+/g, ""),
    "S", // Address type: structured
    input.creditor.name,
    input.creditor.addressLine1,
    input.creditor.addressLine2 ?? "",
    input.creditor.postalCode,
    input.creditor.city,
    input.creditor.countryCode,

    // UltmtCdtr — deprecated since v2.2, fields present but always empty
    "",
    "",
    "",
    "",
    "",
    "",
    "",

    // CcyAmt
    input.amount !== undefined ? input.amount.toFixed(2) : "",
    input.currency,

    // UltmtDbtr — debtor, omitted entirely if unknown
    input.debtor ? "S" : "",
    input.debtor?.name ?? "",
    input.debtor?.addressLine1 ?? "",
    input.debtor?.addressLine2 ?? "",
    input.debtor?.postalCode ?? "",
    input.debtor?.city ?? "",
    input.debtor?.countryCode ?? "",

    // RmtInf
    referenceType,
    input.qrrReference ?? "",
    input.unstructuredMessage ?? "",

    "EPD", // Trailer: End Payment Data
  ];

  if (input.billingInformation) lines.push(input.billingInformation);

  return lines.join(EOL);
}
