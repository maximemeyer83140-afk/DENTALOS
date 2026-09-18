"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { createTreatmentPlanAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function TreatmentPlanForm({
  patientId,
  practitioners,
}: {
  patientId: string;
  practitioners: { id: string; name: string }[];
}): ReactNode {
  const boundAction = createTreatmentPlanAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="tp-practitioner" className="text-xs font-medium text-muted-foreground">
          Praticien
        </label>
        <select
          id="tp-practitioner"
          name="practitionerId"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {practitioners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="tp-tooth" className="text-xs font-medium text-muted-foreground">
          Dent
        </label>
        <input
          id="tp-tooth"
          name="toothNumber"
          type="number"
          min={11}
          max={48}
          className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <div className="flex min-w-[200px] flex-grow flex-col gap-1">
        <label htmlFor="tp-description" className="text-xs font-medium text-muted-foreground">
          Acte
        </label>
        <input
          id="tp-description"
          name="description"
          placeholder="ex. Couronne céramique"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="tp-price" className="text-xs font-medium text-muted-foreground">
          Prix (CHF)
        </label>
        <input
          id="tp-price"
          name="unitPrice"
          type="number"
          min={0}
          step={0.05}
          className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Création…" : "Nouveau plan"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
