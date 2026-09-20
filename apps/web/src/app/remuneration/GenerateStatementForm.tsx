"use client";

import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import { generateStatementAction, type ActionState } from "./actions";

const initialState: ActionState = {};

function firstOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GenerateStatementForm({ practitionerId }: { practitionerId: string }): ReactNode {
  const boundAction = generateStatementAction.bind(null, practitionerId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="stmt-periodStart" className="text-xs font-medium text-muted-foreground">
          Début de période
        </label>
        <input
          id="stmt-periodStart"
          name="periodStart"
          type="date"
          required
          defaultValue={firstOfMonthIso()}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="stmt-periodEnd" className="text-xs font-medium text-muted-foreground">
          Fin de période
        </label>
        <input
          id="stmt-periodEnd"
          name="periodEnd"
          type="date"
          required
          defaultValue={todayIso()}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "…" : "Générer le décompte"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
