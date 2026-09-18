import { describe, expect, it } from "vitest";

import {
  buildQrrReference,
  buildSwissQrBillPayload,
  computeMod10CheckDigit,
  formatQrrReferenceForDisplay,
  verifyQrrReference,
} from "./swiss-qr-bill";

describe("Modulo 10 recursive check digit", () => {
  it("is deterministic for the same input", () => {
    expect(computeMod10CheckDigit("12345")).toBe(computeMod10CheckDigit("12345"));
  });

  it("rejects non-digit input", () => {
    expect(() => computeMod10CheckDigit("12a45")).toThrow();
  });
});

describe("QRR reference", () => {
  it("builds a 27-digit reference from a numeric id, zero-padded", () => {
    const ref = buildQrrReference("42");
    expect(ref).toHaveLength(27);
    expect(ref.startsWith("0".repeat(24))).toBe(true);
  });

  it("round-trips: a reference it builds always verifies", () => {
    for (const id of ["1", "42", "999999", "12345678901234567890123456"]) {
      const ref = buildQrrReference(id);
      expect(verifyQrrReference(ref)).toBe(true);
    }
  });

  it("detects a corrupted reference (transcription error)", () => {
    const ref = buildQrrReference("2026000148");
    const corrupted = ref.slice(0, -1) + String((Number(ref.at(-1)) + 1) % 10);
    expect(verifyQrrReference(corrupted)).toBe(false);
  });

  it("rejects a source with more than 26 digits", () => {
    expect(() => buildQrrReference("1".repeat(27))).toThrow();
  });

  it("formats a reference with a space every 5 digits from the right", () => {
    const formatted = formatQrrReferenceForDisplay("210000000003139471430009017");
    expect(formatted.replace(/\s/g, "")).toBe("210000000003139471430009017");
    expect(formatted.endsWith(" 09017")).toBe(true);
  });
});

describe("Swiss QR-bill payload", () => {
  const baseInput = {
    creditorIban: "CH93 0076 2011 6238 5295 7",
    creditor: {
      name: "Cabinet Dentaire Léman",
      addressLine1: "Rue du Rhône 10",
      postalCode: "1204",
      city: "Genève",
      countryCode: "CH",
    },
    amount: 1234.5,
    currency: "CHF" as const,
    qrrReference: buildQrrReference("2026000148"),
    unstructuredMessage: "Facture 2026-0148",
  };

  it("starts with the mandatory header fields in order", () => {
    const payload = buildSwissQrBillPayload(baseInput);
    const lines = payload.split("\r\n");
    expect(lines.slice(0, 3)).toEqual(["SPC", "0200", "1"]);
  });

  it("strips whitespace from the IBAN", () => {
    const payload = buildSwissQrBillPayload(baseInput);
    const lines = payload.split("\r\n");
    expect(lines[3]).toBe("CH9300762011623852957");
  });

  it("uses CRLF line endings as the standard requires", () => {
    const payload = buildSwissQrBillPayload(baseInput);
    expect(payload).toContain("\r\n");
    expect(payload.split("\r\n").join("")).not.toContain("\n");
  });

  it("ends with the EPD trailer", () => {
    const payload = buildSwissQrBillPayload(baseInput);
    const lines = payload.split("\r\n");
    expect(lines).toContain("EPD");
  });

  it("marks the reference type as QRR when a QRR reference is supplied", () => {
    const payload = buildSwissQrBillPayload(baseInput);
    expect(payload).toContain("\r\nQRR\r\n");
  });

  it("marks the reference type as NON and leaves the reference empty otherwise", () => {
    const { qrrReference: _drop, ...withoutReference } = baseInput;
    const payload = buildSwissQrBillPayload(withoutReference);
    expect(payload).toContain("\r\nNON\r\n\r\n");
  });
});
