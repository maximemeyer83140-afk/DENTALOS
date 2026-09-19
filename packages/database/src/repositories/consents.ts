import type { Consent, ConsentStatus } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface CreateConsentInput {
  patientId: string;
  templateKey: string;
}

export interface RecordConsentDecisionInput {
  status: Extract<ConsentStatus, "signed" | "declined">;
  signedByName?: string | undefined;
  documentId?: string | undefined;
}

export async function listConsentsForPatient(ctx: TenantContext, patientId: string): Promise<Consent[]> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  return prisma.consent.findMany({
    where: { patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: { createdAt: "desc" },
  });
}

/** Requesting a consent always starts a new `pending` row rather than reusing an old one — a
 * signed/declined consent is a record of what actually happened and must never be silently
 * overwritten (a later version of the same template gets its own row, `version` bumped). */
export async function createConsent(ctx: TenantContext, input: CreateConsentInput, createdBy: string): Promise<Consent> {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${input.patientId} not found`);

  const priorVersions = await prisma.consent.count({
    where: { patientId: input.patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId, templateKey: input.templateKey },
  });

  return prisma.consent.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      templateKey: input.templateKey,
      version: priorVersions + 1,
      createdBy,
    },
  });
}

/** Records the patient's actual decision — signed (with who signed, and optionally the scanned
 * document it was captured on) or declined. A consent already decided is never editable again;
 * re-request a fresh one instead (see `createConsent`'s note on `version`). The `pending` guard is
 * part of the `updateMany` filter itself, so two concurrent decisions on the same consent can
 * never both succeed. */
export async function recordConsentDecision(
  ctx: TenantContext,
  consentId: string,
  input: RecordConsentDecisionInput,
): Promise<Consent> {
  const result = await prisma.consent.updateMany({
    where: { id: consentId, organizationId: ctx.organizationId, clinicId: ctx.clinicId, status: "pending" },
    data: {
      status: input.status,
      signedAt: input.status === "signed" ? new Date() : undefined,
      signedByName: input.signedByName,
      documentId: input.documentId,
    },
  });
  if (result.count === 0) {
    const existing = await prisma.consent.findFirst({
      where: { id: consentId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    });
    if (!existing) throw new NotFoundError(`Consent ${consentId} not found`);
    throw new Error(`Consent ${consentId} was already decided (${existing.status})`);
  }
  return prisma.consent.findFirstOrThrow({
    where: { id: consentId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
}
