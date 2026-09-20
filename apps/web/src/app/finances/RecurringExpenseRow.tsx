"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";

import { EXPENSE_CATEGORY_LABEL, RECURRENCE_INTERVAL_LABEL } from "@/lib/expenses";

import { generateExpenseFromRecurringAction, setRecurringExpenseActiveAction } from "./actions";

export interface RecurringExpenseRowData {
  id: string;
  label: string;
  category: string;
  amount: number;
  intervalUnit: string;
  nextRunAt: Date;
  isActive: boolean;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function RecurringExpenseRow({ expense }: { expense: RecurringExpenseRowData }): ReactNode {
  const [generating, startGenerating] = useTransition();
  const [toggling, startToggling] = useTransition();

  return (
    <li className={`rounded-md border border-border px-3 py-2 text-sm ${expense.isActive ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-foreground">{expense.label}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {EXPENSE_CATEGORY_LABEL[expense.category] ?? expense.category} · {RECURRENCE_INTERVAL_LABEL[expense.intervalUnit] ?? expense.intervalUnit} · CHF{" "}
            {expense.amount.toFixed(2)} · prochaine échéance {formatDate(expense.nextRunAt)}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {expense.isActive ? (
            <button
              type="button"
              disabled={generating}
              onClick={() => startGenerating(() => generateExpenseFromRecurringAction(expense.id))}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {generating ? "…" : "Générer maintenant"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={toggling}
            onClick={() => startToggling(() => setRecurringExpenseActiveAction(expense.id, !expense.isActive))}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {toggling ? "…" : expense.isActive ? "Désactiver" : "Réactiver"}
          </button>
        </div>
      </div>
    </li>
  );
}
