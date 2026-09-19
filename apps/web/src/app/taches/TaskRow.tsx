"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState } from "react";

import { TASK_PRIORITY_CLASS, TASK_PRIORITY_LABEL, TASK_STATUS_OPTIONS } from "@/lib/tasks";

import { updateTaskStatusAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface TaskRowData {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueAt: Date | null;
  assignedToUserId: string | null;
  patient: { id: string; firstName: string; lastName: string } | null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function TaskRow({ task, assigneeName, isOverdue }: { task: TaskRowData; assigneeName: string | null; isOverdue: boolean }): ReactNode {
  const boundUpdate = updateTaskStatusAction.bind(null, task.id);
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);

  return (
    <tr className={isOverdue ? "bg-red-50/50" : undefined}>
      <td className="px-3 py-2">
        <div className="font-medium text-foreground">{task.title}</div>
        {task.description ? <div className="text-xs text-muted-foreground">{task.description}</div> : null}
        {task.patient ? (
          <Link href={`/patients/${task.patient.id}`} className="text-xs font-medium text-primary hover:underline">
            {task.patient.firstName} {task.patient.lastName}
          </Link>
        ) : null}
      </td>
      <td className="px-3 py-2 text-sm text-foreground">{assigneeName ?? "—"}</td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TASK_PRIORITY_CLASS[task.priority] ?? "bg-muted"}`}>
          {TASK_PRIORITY_LABEL[task.priority] ?? task.priority}
        </span>
      </td>
      <td className={`px-3 py-2 text-sm ${isOverdue ? "font-semibold text-red-700" : "text-foreground"}`}>
        {task.dueAt ? formatDate(task.dueAt) : "—"}
        {isOverdue ? " · en retard" : ""}
      </td>
      <td className="px-3 py-2">
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
        {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      </td>
    </tr>
  );
}
