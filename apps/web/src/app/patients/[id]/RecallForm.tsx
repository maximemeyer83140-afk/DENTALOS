"use client";

import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import { createRecallAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function RecallForm({ patientId }: { patientId: string }): ReactNode {
  const boundAction = createRecallAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="recall-dueDate" className="text-xs font-medium text-muted-foreground">
          Échéance
        </label>
        <input
          id="recall-dueDate"
          name="dueDate"
          type="date"
          required
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <div className="flex min-w-[180px] flex-grow flex-col gap-1">
        <label htmlFor="recall-reason" className="text-xs font-medium text-muted-foreground">
          Motif
        </label>
        <input
          id="recall-reason"
          name="reason"
          placeholder="ex. Contrôle annuel, détartrage 6 mois"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="flex min-w-[180px] flex-grow flex-col gap-1">
        <label htmlFor="recall-notes" className="text-xs font-medium text-muted-foreground">
          Note (facultatif)
        </label>
        <input
          id="recall-notes"
          name="notes"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "…" : "Planifier le rappel"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
