"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";

import { EXPENSE_CATEGORY_OPTIONS, RECURRENCE_INTERVAL_OPTIONS } from "@/lib/expenses";

import { createRecurringExpenseAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function CreateRecurringExpenseForm(): ReactNode {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createRecurringExpenseAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        + Charge récurrente
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex min-w-[160px] flex-col gap-1">
        <label htmlFor="rec-label" className="text-xs font-medium text-muted-foreground">
          Libellé
        </label>
        <input id="rec-label" name="label" required placeholder="ex. Loyer du cabinet" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="rec-category" className="text-xs font-medium text-muted-foreground">
          Catégorie
        </label>
        <select id="rec-category" name="category" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          {EXPENSE_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex w-28 flex-col gap-1">
        <label htmlFor="rec-amount" className="text-xs font-medium text-muted-foreground">
          Montant
        </label>
        <input id="rec-amount" name="amount" type="number" step="0.01" min="0" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="rec-interval" className="text-xs font-medium text-muted-foreground">
          Fréquence
        </label>
        <select id="rec-interval" name="intervalUnit" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          {RECURRENCE_INTERVAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="rec-nextRunAt" className="text-xs font-medium text-muted-foreground">
          Prochaine échéance
        </label>
        <input id="rec-nextRunAt" name="nextRunAt" type="date" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {pending ? "…" : "Créer"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
        Annuler
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
