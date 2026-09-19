"use client";

import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import { TASK_PRIORITY_OPTIONS } from "@/lib/tasks";

import { createTaskAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface AssigneeOption {
  id: string;
  name: string;
}

export function TaskForm({ assignees }: { assignees: AssigneeOption[] }): ReactNode {
  const [state, formAction, pending] = useActionState(createTaskAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex min-w-[200px] flex-grow flex-col gap-1">
        <label htmlFor="task-title" className="text-xs font-medium text-muted-foreground">
          Titre
        </label>
        <input
          id="task-title"
          name="title"
          required
          placeholder="ex. Rappeler le laboratoire pour la prothèse"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="task-priority" className="text-xs font-medium text-muted-foreground">
          Priorité
        </label>
        <select
          id="task-priority"
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
        <label htmlFor="task-assignee" className="text-xs font-medium text-muted-foreground">
          Assignée à
        </label>
        <select
          id="task-assignee"
          name="assignedToUserId"
          defaultValue=""
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">Non assignée</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="task-dueAt" className="text-xs font-medium text-muted-foreground">
          Échéance
        </label>
        <input
          id="task-dueAt"
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
