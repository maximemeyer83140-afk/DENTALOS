"use server";

import { revalidatePath } from "next/cache";

import {
  generateCompensationStatement,
  markStatementPaid,
  setCompensationRule,
  setStatementAdjustment,
  validateStatement,
} from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { generateStatementSchema, setCompensationRuleSchema, setStatementAdjustmentSchema } from "@/lib/validation/compensation";

export interface ActionState {
  error?: string;
}

export async function setCompensationRuleAction(
  practitionerId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = setCompensationRuleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "compensation.write");
  try {
    await setCompensationRule(
      ctx,
      practitionerId,
      { model: parsed.data.model, rate: parsed.data.rate, config: parsed.data.config, validFrom: new Date(parsed.data.validFrom) },
      ctx.userId,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible d'enregistrer ce taux." };
  }

  revalidatePath("/remuneration");
  revalidatePath(`/remuneration/${practitionerId}`);
  return {};
}

export async function generateStatementAction(
  practitionerId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = generateStatementSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const periodStart = new Date(parsed.data.periodStart);
  // Un input type="date" ne porte pas d'heure — sans ceci, "28.02" exclurait tout ce qui s'est
  // passé après minuit ce jour-là (23h59 la veille du 1er mars étant la seule heure couverte).
  const periodEnd = new Date(`${parsed.data.periodEnd}T23:59:59.999`);
  if (periodEnd < periodStart) return { error: "La date de fin doit être après la date de début." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "compensation.write");
  try {
    await generateCompensationStatement(ctx, practitionerId, periodStart, periodEnd, ctx.userId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de générer ce décompte." };
  }

  revalidatePath(`/remuneration/${practitionerId}`);
  return {};
}

export async function setStatementAdjustmentAction(
  practitionerId: string,
  statementId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = setStatementAdjustmentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "compensation.write");
  try {
    await setStatementAdjustment(ctx, statementId, parsed.data.adjustments, parsed.data.notes);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible d'ajuster ce décompte." };
  }

  revalidatePath(`/remuneration/${practitionerId}`);
  return {};
}

export async function validateStatementAction(practitionerId: string, statementId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "compensation.write");
  await validateStatement(ctx, statementId);
  revalidatePath(`/remuneration/${practitionerId}`);
}

export async function markStatementPaidAction(practitionerId: string, statementId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "compensation.write");
  await markStatementPaid(ctx, statementId);
  revalidatePath(`/remuneration/${practitionerId}`);
}
