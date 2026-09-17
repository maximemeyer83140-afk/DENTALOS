import type { PatientMedicalProfile } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

// See the comment on CreatePatientInput (patients.ts) for why optional fields say `| undefined`.
export interface MedicalProfileInput {
  allergies?: string[] | undefined;
  medications?: string[] | undefined;
  conditions?: string[] | undefined;
  isPregnant?: boolean | undefined;
  isSmoker?: boolean | undefined;
  onAnticoagulants?: boolean | undefined;
  riskNotes?: string | undefined;
}

async function assertPatientInTenant(ctx: TenantContext, patientId: string): Promise<void> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);
}

export async function getMedicalProfile(
  ctx: TenantContext,
  patientId: string,
): Promise<PatientMedicalProfile | null> {
  await assertPatientInTenant(ctx, patientId);
  return prisma.patientMedicalProfile.findUnique({ where: { patientId } });
}

/**
 * The only sanctioned way to write a patient's medical profile (section 6 of the brief: never
 * overwrite silently). If a profile already exists, its pre-update state is snapshotted into a
 * `PatientMedicalProfileRevision` in the same transaction before the new values are applied, so
 * the full history stays reconstructable. A first-time profile (none exists yet) has nothing to
 * snapshot and is simply created at version 1.
 */
export async function updateMedicalProfile(
  ctx: TenantContext,
  patientId: string,
  input: MedicalProfileInput,
  updatedBy: string,
): Promise<PatientMedicalProfile> {
  await assertPatientInTenant(ctx, patientId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.patientMedicalProfile.findUnique({ where: { patientId } });

    if (!existing) {
      return tx.patientMedicalProfile.create({
        data: {
          patientId,
          allergies: input.allergies ?? [],
          medications: input.medications ?? [],
          conditions: input.conditions ?? [],
          isPregnant: input.isPregnant,
          isSmoker: input.isSmoker,
          onAnticoagulants: input.onAnticoagulants,
          riskNotes: input.riskNotes,
          version: 1,
          updatedBy,
        },
      });
    }

    await tx.patientMedicalProfileRevision.create({
      data: {
        profileId: existing.id,
        version: existing.version,
        recordedBy: updatedBy,
        snapshot: {
          allergies: existing.allergies,
          medications: existing.medications,
          conditions: existing.conditions,
          isPregnant: existing.isPregnant,
          isSmoker: existing.isSmoker,
          onAnticoagulants: existing.onAnticoagulants,
          riskNotes: existing.riskNotes,
        },
      },
    });

    return tx.patientMedicalProfile.update({
      where: { patientId },
      data: {
        allergies: input.allergies ?? existing.allergies,
        medications: input.medications ?? existing.medications,
        conditions: input.conditions ?? existing.conditions,
        isPregnant: input.isPregnant ?? existing.isPregnant,
        isSmoker: input.isSmoker ?? existing.isSmoker,
        onAnticoagulants: input.onAnticoagulants ?? existing.onAnticoagulants,
        riskNotes: input.riskNotes ?? existing.riskNotes,
        version: existing.version + 1,
        updatedBy,
      },
    });
  });
}

export async function listMedicalProfileRevisions(ctx: TenantContext, patientId: string) {
  await assertPatientInTenant(ctx, patientId);
  const profile = await prisma.patientMedicalProfile.findUnique({ where: { patientId } });
  if (!profile) return [];
  return prisma.patientMedicalProfileRevision.findMany({
    where: { profileId: profile.id },
    orderBy: { version: "desc" },
  });
}
