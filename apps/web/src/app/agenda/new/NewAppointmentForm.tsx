"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { createAppointmentAction, type CreateAppointmentFormState } from "../actions";

const initialState: CreateAppointmentFormState = {};

export function NewAppointmentForm({
  defaultDate,
  practitioners,
  rooms,
  patients,
}: {
  defaultDate: string;
  practitioners: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  patients: { id: string; name: string }[];
}): ReactNode {
  const [state, formAction, pending] = useActionState(createAppointmentAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="patientId" className="text-sm font-medium text-foreground">
          Patient
        </label>
        <select
          id="patientId"
          name="patientId"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">— Sans patient (bloc réservé) —</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="practitionerId" className="text-sm font-medium text-foreground">
            Praticien *
          </label>
          <select
            id="practitionerId"
            name="practitionerId"
            required
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="roomId" className="text-sm font-medium text-foreground">
            Salle
          </label>
          <select
            id="roomId"
            name="roomId"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">—</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="date" className="text-sm font-medium text-foreground">
            Date *
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={defaultDate}
            required
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startTime" className="text-sm font-medium text-foreground">
            Heure *
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue="09:00"
            required
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="durationMinutes" className="text-sm font-medium text-foreground">
            Durée (min) *
          </label>
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={5}
            max={480}
            step={5}
            defaultValue={30}
            required
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-foreground">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer le rendez-vous"}
      </button>
    </form>
  );
}
