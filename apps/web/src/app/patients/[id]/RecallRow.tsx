"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";

import { RECALL_STATUS_CLASS, RECALL_STATUS_LABEL, RECALL_STATUS_OPTIONS } from "@/lib/recalls";

import { updateRecallStatusFromPatientAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface RecallRowData {
  id: string;
  dueDate: Date;
  reason: string | null;
  status: string;
  notes: string | null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function RecallRow({ patientId, recall }: { patientId: string; recall: RecallRowData }): ReactNode {
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateRecallStatusFromPatientAction.bind(null, patientId, recall.id);
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);

  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-foreground">{recall.reason ?? "Rappel de contrôle"}</span>
          <span className="ml-2 text-xs text-muted-foreground">Échéance {formatDate(recall.dueDate)}</span>
          {recall.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{recall.notes}</p> : null}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RECALL_STATUS_CLASS[recall.status] ?? "bg-muted"}`}>
            {RECALL_STATUS_LABEL[recall.status] ?? recall.status}
          </span>
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {editing ? "Fermer" : "Modifier"}
          </button>
        </div>
      </div>

      {editing ? (
        <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`status-${recall.id}`} className="text-xs font-medium text-muted-foreground">
              Statut
            </label>
            <select
              id={`status-${recall.id}`}
              name="status"
              defaultValue={recall.status}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {RECALL_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[180px] flex-grow flex-col gap-1">
            <label htmlFor={`notes-${recall.id}`} className="text-xs font-medium text-muted-foreground">
              Note
            </label>
            <input
              id={`notes-${recall.id}`}
              name="notes"
              defaultValue={recall.notes ?? ""}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "…" : "Enregistrer"}
          </button>
          {state.error ? (
            <p role="alert" className="w-full text-xs text-red-600">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
