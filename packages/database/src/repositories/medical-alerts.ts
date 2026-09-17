import type { MedicalAlert, MedicalAlertSeverity, MedicalAlertType } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

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
