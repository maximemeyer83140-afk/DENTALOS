"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { LAB_CASE_STATUS_CLASS, LAB_CASE_STATUS_LABEL, LAB_CASE_STATUS_OPTIONS } from "@/lib/laboratory";

import { updateLabCaseStatusFromPatientAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface LabCaseRowData {
  id: string;
  workType: string;
  toothNumber: number | null;
  status: string;
  expectedAt: Date | null;
  laboratory: { name: string };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function LabCaseRow({ patientId, labCase }: { patientId: string; labCase: LabCaseRowData }): ReactNode {
  const boundAction = updateLabCaseStatusFromPatientAction.bind(null, patientId, labCase.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-foreground">
            {labCase.workType}
            {labCase.toothNumber ? ` · dent ${labCase.toothNumber}` : ""}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            {labCase.laboratory.name}
            {labCase.expectedAt ? ` · retour attendu ${formatDate(labCase.expectedAt)}` : ""}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LAB_CASE_STATUS_CLASS[labCase.status] ?? "bg-muted"}`}>
            {LAB_CASE_STATUS_LABEL[labCase.status] ?? labCase.status}
          </span>
        </div>
      </div>
      {labCase.status !== "completed" ? (
        <form action={formAction} className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <select name="status" defaultValue={labCase.status} className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
            {LAB_CASE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60">
            {pending ? "…" : "Mettre à jour"}
          </button>
          {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
        </form>
      ) : null}
    </li>
  );
}
