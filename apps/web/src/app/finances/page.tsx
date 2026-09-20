import type { ReactNode } from "react";

import { listExpenses, listRecurringExpenses } from "@dentalos/database";

import { AppNav } from "@/components/AppNav";
import { getDefaultClinicId } from "@/lib/clinic-context";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expenses";
import { requirePermission } from "@/lib/rbac";

import { CreateExpenseForm } from "./CreateExpenseForm";
import { CreateRecurringExpenseForm } from "./CreateRecurringExpenseForm";
import { RecurringExpenseRow } from "./RecurringExpenseRow";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * ÉTAPE 16 : charges du cabinet — `Expense`/`RecurringExpense` existaient au schéma depuis la
 * Phase 0 (les permissions `expenses.read`/`expenses.write` aussi) sans jamais avoir de repository
 * ni d'UI. Un cabinet dentaire a des charges fixes récurrentes (loyer, assurances, logiciels) en
 * plus des charges ponctuelles — les deux se suivent ici, avec une génération manuelle des
 * occurrences récurrentes faute de scheduler réel dans cet environnement (voir PHASE_12.md).
 */
export default async function FinancesPage(): Promise<ReactNode> {
  const clinicId = await getDefaultClinicId();
  const ctx = await requirePermission(clinicId, "expenses.read");
  const [expenses, recurringExpenses] = await Promise.all([listExpenses(ctx), listRecurringExpenses(ctx)]);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const expensesThisMonth = expenses.filter((e) => e.date >= monthStart);
  const totalThisMonth = expensesThisMonth.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <AppNav current="finances" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Finances</h1>
        <p className="text-sm text-muted-foreground">
          {expensesThisMonth.length} charge(s) ce mois-ci · CHF {totalThisMonth.toFixed(2)}
        </p>
      </div>

      <div className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Charges récurrentes ({recurringExpenses.length})</h2>
        <div className="mb-3">
          <CreateRecurringExpenseForm />
        </div>
        <ul className="flex flex-col gap-2">
          {recurringExpenses.map((expense) => (
            <RecurringExpenseRow key={expense.id} expense={{ ...expense, amount: Number(expense.amount) }} />
          ))}
          {recurringExpenses.length === 0 ? <li className="text-sm text-muted-foreground">Aucune charge récurrente.</li> : null}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Charges ({expenses.length})</h2>
        <div className="mb-3">
          <CreateExpenseForm />
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Catégorie</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-3 py-2 text-foreground">{formatDate(expense.date)}</td>
                  <td className="px-3 py-2 text-foreground">{EXPENSE_CATEGORY_LABEL[expense.category] ?? expense.category}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{expense.notes ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-foreground">CHF {Number(expense.amount).toFixed(2)}</td>
                </tr>
              ))}
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Aucune charge enregistrée.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
