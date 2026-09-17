"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { addAlertAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function AlertForm({ patientId }: { patientId: string }): ReactNode {
  const boundAction = addAlertAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="alert-type" className="text-xs font-medium text-muted-foreground">
          Type
        </label>
        <select
          id="alert-type"
          name="type"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="allergy">Allergie</option>
          <option value="medication">Médicament</option>
          <option value="condition">Condition</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="alert-severity" className="text-xs font-medium text-muted-foreground">
          Sévérité
        </label>
        <select
          id="alert-severity"
          name="severity"
          defaultValue="warning"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="info">Info</option>
          <option value="warning">Attention</option>
          <option value="critical">Critique</option>
        </select>
      </div>
      <div className="flex min-w-[200px] flex-grow flex-col gap-1">
        <label htmlFor="alert-label" className="text-xs font-medium text-muted-foreground">
          Libellé
        </label>
        <input
          id="alert-label"
          name="label"
          placeholder="ex. Allergie pénicilline"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Ajout…" : "Ajouter l'alerte"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
