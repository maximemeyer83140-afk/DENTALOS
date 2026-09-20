"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState } from "react";

import { LAB_CASE_STATUS_CLASS, LAB_CASE_STATUS_LABEL, LAB_CASE_STATUS_OPTIONS } from "@/lib/laboratory";

import { updateLabCaseStatusFromDashboardAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface LabCaseDashboardRowData {
  id: string;
  workType: string;
  toothNumber: number | null;
  status: string;
  expectedAt: Date | null;
  patient: { id: string; firstName: string; lastName: string };
  laboratory: { name: string };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function LabCaseDashboardRow({ labCase, isOverdue }: { labCase: LabCaseDashboardRowData; isOverdue: boolean }): ReactNode {
  const boundAction = updateLabCaseStatusFromDashboardAction.bind(null, labCase.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <tr className={isOverdue ? "bg-red-50/50" : undefined}>
      <td className="px-3 py-2">
        <Link href={`/patients/${labCase.patient.id}?tab=clinique`} className="font-medium text-primary hover:underline">
          {labCase.patient.firstName} {labCase.patient.lastName}
        </Link>
      </td>
      <td className="px-3 py-2 text-sm text-foreground">
        {labCase.workType}
        {labCase.toothNumber ? ` (dent ${labCase.toothNumber})` : ""}
      </td>
      <td className="px-3 py-2 text-sm text-foreground">{labCase.laboratory.name}</td>
      <td className={`px-3 py-2 text-sm ${isOverdue ? "font-semibold text-red-700" : "text-foreground"}`}>
        {labCase.expectedAt ? formatDate(labCase.expectedAt) : "—"}
        {isOverdue ? " · en retard" : ""}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LAB_CASE_STATUS_CLASS[labCase.status] ?? "bg-muted"}`}>
          {LAB_CASE_STATUS_LABEL[labCase.status] ?? labCase.status}
        </span>
      </td>
      <td className="px-3 py-2">
        <form action={formAction} className="flex items-center gap-1">
          <select name="status" defaultValue={labCase.status} className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
            {LAB_CASE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60">
            {pending ? "…" : "OK"}
          </button>
        </form>
        {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      </td>
    </tr>
  );
}
