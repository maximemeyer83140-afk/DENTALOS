"use server";

import { revalidatePath } from "next/cache";

import { createExpense, createRecurringExpense, generateExpenseFromRecurring, setRecurringExpenseActive } from "@dentalos/database";

import { getDefaultClinicId } from "@/lib/clinic-context";
import { requirePermission } from "@/lib/rbac";
import { createExpenseSchema, createRecurringExpenseSchema } from "@/lib/validation/expenses";

export interface ActionState {
  error?: string;
}

export async function createExpenseAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createExpenseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "expenses.write");
  await createExpense(
    ctx,
    { category: parsed.data.category, amount: parsed.data.amount, taxAmount: parsed.data.taxAmount, date: new Date(parsed.data.date), notes: parsed.data.notes },
    ctx.userId,
  );

  revalidatePath("/finances");
  return {};
}

export async function createRecurringExpenseAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createRecurringExpenseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "expenses.write");
  await createRecurringExpense(
    ctx,
    { category: parsed.data.category, label: parsed.data.label, amount: parsed.data.amount, intervalUnit: parsed.data.intervalUnit, nextRunAt: new Date(parsed.data.nextRunAt) },
    ctx.userId,
  );

  revalidatePath("/finances");
  return {};
}

export async function generateExpenseFromRecurringAction(recurringExpenseId: string): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "expenses.write");
  await generateExpenseFromRecurring(ctx, recurringExpenseId, ctx.userId);
  revalidatePath("/finances");
}

export async function setRecurringExpenseActiveAction(recurringExpenseId: string, isActive: boolean): Promise<void> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "expenses.write");
  await setRecurringExpenseActive(ctx, recurringExpenseId, isActive);
  revalidatePath("/finances");
}
