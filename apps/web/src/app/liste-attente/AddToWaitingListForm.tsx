"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { addToWaitingListAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface EligibleAppointment {
  id: string;
  startAt: Date;
  patient: { firstName: string; lastName: string } | null;
  practitioner: { firstName: string; lastName: string };
  appointmentType: { name: string } | null;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Le patient doit déjà avoir un rendez-vous fixé — pas de champ patient/type libre, uniquement un
 * choix parmi les rendez-vous à venir (voir page.tsx pour le filtrage des candidats éligibles). */
export function AddToWaitingListForm({ appointments }: { appointments: EligibleAppointment[] }): ReactNode {
  const [state, formAction, pending] = useActionState(addToWaitingListAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <label className="text-sm font-medium text-foreground" htmlFor="appointmentId">
        Rendez-vous déjà fixé
      </label>
      <select
        id="appointmentId"
        name="appointmentId"
        required
        disabled={appointments.length === 0}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
      >
        {appointments.length === 0 ? <option value="">Aucun rendez-vous éligible dans les 90 prochains jours</option> : null}
        {appointments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "—"} — {formatDateTime(a.startAt)} —{" "}
            {a.appointmentType?.name ?? "Rendez-vous"} — Dr {a.practitioner.lastName}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap items-center gap-2">
        <select
          name="urgency"
          defaultValue="normal"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="low">Urgence : faible</option>
          <option value="normal">Urgence : normale</option>
          <option value="high">Urgence : haute</option>
          <option value="urgent">Urgence : urgente</option>
        </select>
        <input
          type="text"
          name="availabilityNotes"
          placeholder="Disponibilités (ex. lundi/mercredi matin)"
          className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || appointments.length === 0}
        className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Ajout…" : "Ajouter à la liste d'attente"}
      </button>
    </form>
  );
}
