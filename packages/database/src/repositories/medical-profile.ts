import type { PatientMedicalProfile } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";
import { syncDerivedAlerts } from "./medical-alerts";

/** One row of the "Pathologies / antécédents" questionnaire (ÉTAPE 4) — a fixed, known list of
 * codes (see apps/web/src/lib/anamnese.ts's PATHOLOGY_DEFS), each either flagged present or not,
 * with optional free-text precision. */
export interface PathologyEntry {
  present: boolean;
  notes?: string;
}

export type PathologyRecord = Record<string, PathologyEntry>;

export interface MedicationEntry {
  name: string;
  dose?: string;
  frequency?: string;
  comment?: string;
}

// See the comment on CreatePatientInput (patients.ts) for why optional fields say `| undefined`.
export interface MedicalProfileInput {
  pathologies?: PathologyRecord | undefined;
  medications?: MedicationEntry[] | undefined;
  allergies?: string[] | undefined;
  isPregnant?: boolean | undefined;
  isSmoker?: boolean | undefined;
  alcoholUse?: boolean | undefined;
  onAnticoagulants?: boolean | undefined;
  onAntiplatelets?: boolean | undefined;
  pastSurgeries?: string[] | undefined;
  treatingPhysician?: string | undefined;
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

function allergyAlertLabel(allergies: string[], pathologyNotes: string | undefined): string {
  if (allergies.length > 0) return `Allergie : ${allergies.join(", ")}`;
  if (pathologyNotes) return `Allergie : ${pathologyNotes}`;
  return "Allergie (non précisée)";
}

/** The handful of anamnèse fields important enough to surface as an always-visible banner alert
 * (ÉTAPE 4: "⚠ ALLERGIE : PÉNICILLINE", "⚠ TRAITEMENT ANTICOAGULANT"), derived from whatever the
 * profile now says — never a separate decision the user has to remember to make. */
function computeDerivedAlertSignals(
  allergies: string[],
  pathologies: PathologyRecord,
  isPregnant: boolean | null | undefined,
  onAnticoagulants: boolean | null | undefined,
  onAntiplatelets: boolean | null | undefined,
) {
  const allergyPresent = allergies.length > 0 || Boolean(pathologies.allergies?.present);
  return [
    {
      sourceKey: "allergy",
      type: "allergy" as const,
      label: allergyAlertLabel(allergies, pathologies.allergies?.notes),
      severity: "critical" as const,
      active: allergyPresent,
    },
    {
      sourceKey: "anticoagulant",
      type: "medication" as const,
      label: "Traitement anticoagulant",
      severity: "critical" as const,
      active: Boolean(onAnticoagulants),
    },
    {
      sourceKey: "antiplatelet",
      type: "medication" as const,
      label: "Traitement antiagrégant",
      severity: "warning" as const,
      active: Boolean(onAntiplatelets),
    },
    {
      sourceKey: "pregnancy",
      type: "condition" as const,
      label: "Grossesse en cours",
      severity: "warning" as const,
      active: Boolean(isPregnant),
    },
  ];
}

/**
 * The only sanctioned way to write a patient's medical profile (section 6 of the brief: never
 * overwrite silently). If a profile already exists, its pre-update state is snapshotted into a
 * `PatientMedicalProfileRevision` in the same transaction before the new values are applied, so
 * the full history stays reconstructable. A first-time profile (none exists yet) has nothing to
 * snapshot and is simply created at version 1. Also resyncs the derived banner alerts (allergy,
 * anticoagulant, antiplatelet, pregnancy) in the same transaction, so the profile and what the rest
 * of the fiche patient shows about it can never drift apart.
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

    const pathologies = input.pathologies ?? (existing?.pathologies as PathologyRecord | undefined) ?? {};
    const medications = input.medications ?? (existing?.medications as MedicationEntry[] | undefined) ?? [];
    const allergies = input.allergies ?? existing?.allergies ?? [];
    const isPregnant = input.isPregnant ?? existing?.isPregnant;
    const isSmoker = input.isSmoker ?? existing?.isSmoker;
    const alcoholUse = input.alcoholUse ?? existing?.alcoholUse;
    const onAnticoagulants = input.onAnticoagulants ?? existing?.onAnticoagulants;
    const onAntiplatelets = input.onAntiplatelets ?? existing?.onAntiplatelets;
    const pastSurgeries = input.pastSurgeries ?? existing?.pastSurgeries ?? [];
    const treatingPhysician = input.treatingPhysician ?? existing?.treatingPhysician;
    const riskNotes = input.riskNotes ?? existing?.riskNotes;

    let profile: PatientMedicalProfile;
    if (!existing) {
      profile = await tx.patientMedicalProfile.create({
        data: {
          patientId,
          pathologies,
          medications,
          allergies,
          isPregnant,
          isSmoker,
          alcoholUse,
          onAnticoagulants,
          onAntiplatelets,
          pastSurgeries,
          treatingPhysician,
          riskNotes,
          version: 1,
          updatedBy,
        },
      });
    } else {
      await tx.patientMedicalProfileRevision.create({
        data: {
          profileId: existing.id,
          version: existing.version,
          recordedBy: updatedBy,
          snapshot: {
            pathologies: existing.pathologies,
            medications: existing.medications,
            allergies: existing.allergies,
            isPregnant: existing.isPregnant,
            isSmoker: existing.isSmoker,
            alcoholUse: existing.alcoholUse,
            onAnticoagulants: existing.onAnticoagulants,
            onAntiplatelets: existing.onAntiplatelets,
            pastSurgeries: existing.pastSurgeries,
            treatingPhysician: existing.treatingPhysician,
            riskNotes: existing.riskNotes,
          },
        },
      });

      profile = await tx.patientMedicalProfile.update({
        where: { patientId },
        data: {
          pathologies,
          medications,
          allergies,
          isPregnant,
          isSmoker,
          alcoholUse,
          onAnticoagulants,
          onAntiplatelets,
          pastSurgeries,
          treatingPhysician,
          riskNotes,
          version: existing.version + 1,
          updatedBy,
        },
      });
    }

    const signals = computeDerivedAlertSignals(allergies, pathologies, isPregnant, onAnticoagulants, onAntiplatelets);
    await syncDerivedAlerts(tx, patientId, signals, updatedBy);

    return profile;
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
