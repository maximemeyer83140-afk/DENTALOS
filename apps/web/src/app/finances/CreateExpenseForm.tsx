"use client";

import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/expenses";

import { createExpenseAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function CreateExpenseForm(): ReactNode {
  const [state, formAction, pending] = useActionState(createExpenseAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="expense-category" className="text-xs font-medium text-muted-foreground">
          Catégorie
        </label>
        <select id="expense-category" name="category" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          {EXPENSE_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex w-28 flex-col gap-1">
        <label htmlFor="expense-amount" className="text-xs font-medium text-muted-foreground">
          Montant
        </label>
        <input id="expense-amount" name="amount" type="number" step="0.01" min="0" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="expense-date" className="text-xs font-medium text-muted-foreground">
          Date
        </label>
        <input id="expense-date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex min-w-[180px] flex-grow flex-col gap-1">
        <label htmlFor="expense-notes" className="text-xs font-medium text-muted-foreground">
          Note (facultatif)
        </label>
        <input id="expense-notes" name="notes" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {pending ? "…" : "Ajouter la charge"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
