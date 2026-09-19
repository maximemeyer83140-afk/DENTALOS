"use client";

import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import { TASK_PRIORITY_OPTIONS } from "@/lib/tasks";

import { createPatientTaskAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function PatientTaskForm({ patientId }: { patientId: string }): ReactNode {
  const boundAction = createPatientTaskAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex min-w-[200px] flex-grow flex-col gap-1">
        <label htmlFor="ptask-title" className="text-xs font-medium text-muted-foreground">
          Tâche
        </label>
        <input
          id="ptask-title"
          name="title"
          required
          placeholder="ex. Relancer le laboratoire pour la prothèse"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ptask-priority" className="text-xs font-medium text-muted-foreground">
          Priorité
        </label>
        <select
          id="ptask-priority"
          name="priority"
          defaultValue="normal"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {TASK_PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ptask-dueAt" className="text-xs font-medium text-muted-foreground">
          Échéance
        </label>
        <input
          id="ptask-dueAt"
          name="dueAt"
          type="date"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "…" : "Créer la tâche"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
