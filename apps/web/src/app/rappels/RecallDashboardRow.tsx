"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState } from "react";

import { RECALL_STATUS_CLASS, RECALL_STATUS_LABEL, RECALL_STATUS_OPTIONS } from "@/lib/recalls";

import { updateRecallStatusFromDashboardAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface RecallDashboardRowData {
  id: string;
  dueDate: Date;
  reason: string | null;
  status: string;
  notes: string | null;
  patient: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function RecallDashboardRow({ recall, isOverdue }: { recall: RecallDashboardRowData; isOverdue: boolean }): ReactNode {
  const boundUpdate = updateRecallStatusFromDashboardAction.bind(null, recall.id);
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);

  return (
    <tr className={isOverdue ? "bg-red-50/50" : undefined}>
      <td className="px-3 py-2">
        <Link href={`/patients/${recall.patient.id}?tab=suivi`} className="font-medium text-primary hover:underline">
          {recall.patient.firstName} {recall.patient.lastName}
        </Link>
        <div className="text-xs text-muted-foreground">{recall.patient.phone ?? recall.patient.email ?? "—"}</div>
      </td>
      <td className="px-3 py-2 text-sm">{recall.reason ?? "Contrôle"}</td>
      <td className={`px-3 py-2 text-sm ${isOverdue ? "font-semibold text-red-700" : "text-foreground"}`}>
        {formatDate(recall.dueDate)}
        {isOverdue ? " · en retard" : ""}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RECALL_STATUS_CLASS[recall.status] ?? "bg-muted"}`}>
          {RECALL_STATUS_LABEL[recall.status] ?? recall.status}
        </span>
      </td>
      <td className="px-3 py-2">
        <form action={formAction} className="flex items-center gap-1">
          <select
            name="status"
            defaultValue={recall.status}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {RECALL_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input type="hidden" name="notes" value={recall.notes ?? ""} />
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
