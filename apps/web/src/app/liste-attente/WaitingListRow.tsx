"use client";

import type { WaitingListEntryWithRelations } from "@dentalos/database";
import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState } from "react";

import { removeFromWaitingListAction, type ActionState } from "./actions";

const initialState: ActionState = {};

const URGENCY_LABEL: Record<string, string> = {
  low: "Faible",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

const URGENCY_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function WaitingListRow({ entry }: { entry: WaitingListEntryWithRelations }): ReactNode {
  const boundRemove = removeFromWaitingListAction.bind(null, entry.id);
  const [state, formAction, pending] = useActionState(boundRemove, initialState);

  return (
    <tr>
      <td className="px-3 py-2">
        <Link href={`/patients/${entry.patient.id}`} className="font-medium text-primary hover:underline">
          {entry.patient.firstName} {entry.patient.lastName}
        </Link>
        <div className="text-xs text-muted-foreground">{entry.patient.phone ?? entry.patient.email ?? "—"}</div>
      </td>
      <td className="px-3 py-2 text-sm">
        {formatDateTime(entry.appointment.startAt)}
        <div className="text-xs text-muted-foreground">
          {entry.appointment.appointmentType?.name ?? "Rendez-vous"} — Dr {entry.appointment.practitioner.lastName}
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCY_CLASS[entry.urgency] ?? "bg-muted"}`}>
          {URGENCY_LABEL[entry.urgency] ?? entry.urgency}
        </span>
      </td>
      <td className="px-3 py-2 text-sm text-muted-foreground">{entry.availabilityNotes ?? "—"}</td>
      <td className="px-3 py-2">
        <form action={formAction} className="flex items-center gap-1">
          <input type="hidden" name="status" value="cancelled" />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {pending ? "…" : "Retirer"}
          </button>
        </form>
        {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      </td>
    </tr>
  );
}
