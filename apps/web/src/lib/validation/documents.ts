import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const documentCategory = z.enum([
  "radiograph",
  "photograph",
  "consent",
  "quote",
  "invoice",
  "prescription",
  "letter",
  "insurance",
  "laboratory",
  "other",
]);

export const uploadDocumentSchema = z.object({
  category: documentCategory,
  comment: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});

export const updateDocumentSchema = z.object({
  fileName: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(255).optional()),
  category: documentCategory.optional(),
  comment: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});

/** 20 MB — generous for a radiograph or scanned consent, small enough that a single upload can't
 * stall the request indefinitely. Revisit if the practice needs to attach full CBCT exports. */
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
