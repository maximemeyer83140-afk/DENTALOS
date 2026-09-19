import type { MedicalAlert, MedicalAlertSeverity, MedicalAlertType, Prisma } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

type TxOrClient = Prisma.TransactionClient | typeof prisma;

export interface AddMedicalAlertInput {
  type: MedicalAlertType;
  label: string;
  severity?: MedicalAlertSeverity | undefined;
}

export async function listActiveAlerts(ctx: TenantContext, patientId: string): Promise<MedicalAlert[]> {
  return prisma.medicalAlert.findMany({
    where: {
      patientId,
      isActive: true,
      patient: { organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function addAlert(
  ctx: TenantContext,
  patientId: string,
  input: AddMedicalAlertInput,
  createdBy: string,
): Promise<MedicalAlert> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError(`Patient ${patientId} not found`);

  return prisma.medicalAlert.create({
    data: {
      patientId,
      type: input.type,
      label: input.label,
      severity: input.severity ?? "warning",
      createdBy,
    },
  });
}

/** Alerts are deactivated, never deleted — the history of what a patient was once flagged for
 * stays available for audit. */
export async function deactivateAlert(ctx: TenantContext, alertId: string): Promise<void> {
  const result = await prisma.medicalAlert.updateMany({
    where: {
      id: alertId,
      patient: { organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    },
    data: { isActive: false },
  });
  if (result.count === 0) throw new NotFoundError(`Medical alert ${alertId} not found`);
}

export interface DerivedAlertSignal {
  /** Stable key identifying which anamnèse signal this alert represents (e.g. "allergy",
   * "anticoagulant") — never a free-text label, so syncing can find "the" alert for a signal again
   * regardless of how its wording changed. */
  sourceKey: string;
  type: MedicalAlertType;
  label: string;
  severity: MedicalAlertSeverity;
  /** Whether the underlying anamnèse field currently justifies showing this alert. */
  active: boolean;
}

/**
 * Keeps the banner alerts that show "toute la fiche" (ÉTAPE 4) in sync with the structured
 * anamnèse, without ever touching an alert a user added by hand through AlertForm — those always
 * have `sourceKey: null`, so this function only ever looks at (and only ever writes) the subset of
 * alerts it created itself for the given `sourceKey`s. Called inside the same transaction as
 * `updateMedicalProfile` so the alerts and the profile that justifies them are never out of sync.
 */
export async function syncDerivedAlerts(
  tx: TxOrClient,
  patientId: string,
  signals: DerivedAlertSignal[],
  updatedBy: string,
): Promise<void> {
  for (const signal of signals) {
    const existing = await tx.medicalAlert.findFirst({
      where: { patientId, sourceKey: signal.sourceKey, isActive: true },
    });

    if (signal.active) {
      if (!existing) {
        await tx.medicalAlert.create({
          data: {
            patientId,
            type: signal.type,
            label: signal.label,
            severity: signal.severity,
            sourceKey: signal.sourceKey,
            createdBy: updatedBy,
          },
        });
      } else if (existing.label !== signal.label || existing.severity !== signal.severity) {
        await tx.medicalAlert.update({
          where: { id: existing.id },
          data: { label: signal.label, severity: signal.severity },
        });
      }
    } else if (existing) {
      await tx.medicalAlert.update({ where: { id: existing.id }, data: { isActive: false } });
    }
  }
}
