import type { Document, DocumentCategory } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface CreateDocumentRecordInput {
  patientId?: string | undefined;
  category: DocumentCategory;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  contentHash?: string | undefined;
  comment?: string | undefined;
}

export interface UpdateDocumentInput {
  fileName?: string | undefined;
  category?: DocumentCategory | undefined;
  comment?: string | null | undefined;
  isArchived?: boolean | undefined;
}

export interface ListDocumentsOptions {
  /** Archived documents are kept forever (ÉTAPE 5's "archiver") but hidden from the default view. */
  includeArchived?: boolean;
}

export async function listDocumentsForPatient(
  ctx: TenantContext,
  patientId: string,
  options: ListDocumentsOptions = {},
): Promise<Document[]> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  return prisma.document.findMany({
    where: {
      patientId,
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      ...(options.includeArchived ? {} : { isArchived: false }),
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Tenant-scoped single lookup — the only sanctioned way to resolve a document before streaming
 * its bytes back (see the patients/[id]/documents/[documentId] route), so a download link can
 * never leak a file across patients or organizations no matter how the id was guessed. */
export async function getDocument(ctx: TenantContext, documentId: string): Promise<Document> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
  if (!document) throw new NotFoundError(`Document ${documentId} not found`);
  return document;
}

/** Records a document's metadata after its bytes have already been written via a `StorageProvider`
 * — this function never touches file content itself. */
export async function createDocumentRecord(
  ctx: TenantContext,
  input: CreateDocumentRecordInput,
  createdBy: string,
): Promise<Document> {
  if (input.patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: input.patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
      select: { id: true },
    });
    if (!patient) throw new NotFoundError(`Patient ${input.patientId} not found`);
  }

  return prisma.document.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      category: input.category,
      fileName: input.fileName,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      contentHash: input.contentHash,
      comment: input.comment,
      createdBy,
    },
  });
}

/** Covers "renommer" (fileName), "classer" (category) and "archiver" (isArchived) from ÉTAPE 5 —
 * one function, since all three are the same kind of metadata-only edit and none of them touch the
 * underlying file bytes. */
export async function updateDocument(
  ctx: TenantContext,
  documentId: string,
  input: UpdateDocumentInput,
): Promise<Document> {
  const result = await prisma.document.updateMany({
    where: { id: documentId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: {
      fileName: input.fileName,
      category: input.category,
      comment: input.comment,
      isArchived: input.isArchived,
    },
  });
  if (result.count === 0) throw new NotFoundError(`Document ${documentId} not found`);
  return getDocument(ctx, documentId);
}
