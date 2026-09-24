"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";

import { createPrescriptionAction, type ActionState } from "./actions";

const initialState: ActionState = {};

interface Row {
  key: string;
  medication: string;
  dosage: string;
  duration: string;
}

function emptyRow(key: string): Row {
  return { key, medication: "", dosage: "", duration: "" };
}

export function PrescriptionForm({
  patientId,
  practitioners,
}: {
  patientId: string;
  practitioners: { id: string; name: string }[];
}): ReactNode {
  const boundAction = createPrescriptionAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [rows, setRows] = useState<Row[]>([emptyRow("row-0")]);

  function updateRow(key: string, patch: Partial<Row>): void {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string): void {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  function addRow(): void {
    setRows((current) => [...current, emptyRow(`row-${current.length}-${Date.now()}`)]);
  }

  const linesJson = JSON.stringify(rows.map(({ medication, dosage, duration }) => ({ medication, dosage, duration })));

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <input type="hidden" name="linesJson" value={linesJson} />

      <select
        name="practitionerId"
        className="self-start rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
      >
        {practitioners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <input
              value={row.medication}
              onChange={(e) => updateRow(row.key, { medication: e.target.value })}
              placeholder="Médicament (ex. Amoxicilline 500mg)"
              className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <input
              value={row.dosage}
              onChange={(e) => updateRow(row.key, { dosage: e.target.value })}
              placeholder="Posologie (ex. 1 cp. 3×/jour)"
              className="w-40 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <input
              value={row.duration}
              onChange={(e) => updateRow(row.key, { duration: e.target.value })}
              placeholder="Durée (ex. 7 jours)"
              className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="self-start rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
      >
        + Ajouter un médicament
      </button>

      <textarea
        name="notes"
        rows={2}
        placeholder="Notes (optionnel)"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
      />

      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer l'ordonnance"}
      </button>
    </form>
  );
}
