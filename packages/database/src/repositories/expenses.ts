import type { Expense, ExpenseCategory, RecurrenceInterval, RecurringExpense } from "@prisma/client";

import { NotFoundError } from "../errors";
import { prisma } from "../index";
import type { TenantContext } from "../tenant-context";

export interface CreateExpenseInput {
  category: ExpenseCategory;
  amount: number;
  taxAmount?: number | undefined;
  date: Date;
  supplierId?: string | undefined;
  attachmentDocumentId?: string | undefined;
  notes?: string | undefined;
}

export interface ListExpensesOptions {
  from?: Date | undefined;
  to?: Date | undefined;
  category?: ExpenseCategory | undefined;
}

export async function listExpenses(ctx: TenantContext, options: ListExpensesOptions = {}): Promise<Expense[]> {
  return prisma.expense.findMany({
    where: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      ...(options.category ? { category: options.category } : {}),
      ...(options.from || options.to
        ? { date: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
        : {}),
    },
    orderBy: { date: "desc" },
  });
}

export async function createExpense(ctx: TenantContext, input: CreateExpenseInput, createdBy: string): Promise<Expense> {
  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, organizationId: ctx.organizationId } });
    if (!supplier) throw new NotFoundError(`Supplier ${input.supplierId} not found`);
  }

  return prisma.expense.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      category: input.category,
      amount: input.amount,
      taxAmount: input.taxAmount,
      date: input.date,
      supplierId: input.supplierId,
      attachmentDocumentId: input.attachmentDocumentId,
      notes: input.notes,
      createdBy,
    },
  });
}

export interface CreateRecurringExpenseInput {
  category: ExpenseCategory;
  label: string;
  amount: number;
  intervalUnit: RecurrenceInterval;
  dayOfMonth?: number | undefined;
  nextRunAt: Date;
}

export async function listRecurringExpenses(ctx: TenantContext): Promise<RecurringExpense[]> {
  return prisma.recurringExpense.findMany({
    where: { organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    orderBy: [{ isActive: "desc" }, { label: "asc" }],
  });
}

export async function createRecurringExpense(
  ctx: TenantContext,
  input: CreateRecurringExpenseInput,
  createdBy: string,
): Promise<RecurringExpense> {
  return prisma.recurringExpense.create({
    data: {
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      category: input.category,
      label: input.label,
      amount: input.amount,
      intervalUnit: input.intervalUnit,
      dayOfMonth: input.dayOfMonth,
      nextRunAt: input.nextRunAt,
      createdBy,
    },
  });
}

export async function setRecurringExpenseActive(ctx: TenantContext, id: string, isActive: boolean): Promise<RecurringExpense> {
  const result = await prisma.recurringExpense.updateMany({
    where: { id, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
    data: { isActive },
  });
  if (result.count === 0) throw new NotFoundError(`Recurring expense ${id} not found`);
  return prisma.recurringExpense.findFirstOrThrow({ where: { id } });
}

function advance(date: Date, unit: RecurrenceInterval): Date {
  const next = new Date(date);
  if (unit === "monthly") next.setMonth(next.getMonth() + 1);
  else if (unit === "quarterly") next.setMonth(next.getMonth() + 3);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}

/**
 * There is no real scheduler in this environment (same limitation as the SMS/email providers
 * documented since Phase 6) — a `RecurringExpense` never fires on its own. This is the manual
 * equivalent: log today's occurrence as a real `Expense` linked back to its template, and advance
 * `nextRunAt` by the template's interval so the UI can still show "prochaine échéance" honestly.
 */
export async function generateExpenseFromRecurring(
  ctx: TenantContext,
  recurringExpenseId: string,
  createdBy: string,
): Promise<Expense> {
  const template = await prisma.recurringExpense.findFirst({
    where: { id: recurringExpenseId, organizationId: ctx.organizationId, clinicId: ctx.clinicId },
  });
  if (!template) throw new NotFoundError(`Recurring expense ${recurringExpenseId} not found`);

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        organizationId: ctx.organizationId,
        clinicId: ctx.clinicId,
        category: template.category,
        amount: template.amount,
        date: new Date(),
        recurringExpenseId: template.id,
        notes: template.label,
        createdBy,
      },
    });
    await tx.recurringExpense.update({
      where: { id: template.id },
      data: { nextRunAt: advance(template.nextRunAt, template.intervalUnit) },
    });
    return expense;
  });
}
