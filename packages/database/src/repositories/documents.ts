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
}

export async function listDocumentsForPatient(ctx: TenantContext, patientId: string): Promise<Document[]> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  return prisma.document.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });
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
      createdBy,
    },
  });
}
