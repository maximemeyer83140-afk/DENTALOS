"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { TASK_PRIORITY_CLASS, TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, TASK_STATUS_OPTIONS } from "@/lib/tasks";

import { updateTaskStatusFromPatientAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface PatientTaskRowData {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueAt: Date | null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function PatientTaskRow({ patientId, task }: { patientId: string; task: PatientTaskRowData }): ReactNode {
  const boundUpdate = updateTaskStatusFromPatientAction.bind(null, patientId, task.id);
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);
  const isDone = task.status === "done" || task.status === "cancelled";

  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className={`font-medium ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.title}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {task.dueAt ? `Échéance ${formatDate(task.dueAt)}` : "Sans échéance"}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TASK_PRIORITY_CLASS[task.priority] ?? "bg-muted"}`}>
            {TASK_PRIORITY_LABEL[task.priority] ?? task.priority}
          </span>
          <form action={formAction} className="flex items-center gap-1">
            <select
              name="status"
              defaultValue={task.status}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              {TASK_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "…" : "OK"}
            </button>
          </form>
        </div>
      </div>
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      {!isDone && task.status !== "open" ? (
        <p className="mt-1 text-xs text-muted-foreground">{TASK_STATUS_LABEL[task.status] ?? task.status}</p>
      ) : null}
    </li>
  );
}
