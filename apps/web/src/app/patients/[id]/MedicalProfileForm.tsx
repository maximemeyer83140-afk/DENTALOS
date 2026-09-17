"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { updateMedicalProfileAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function MedicalProfileForm({
  patientId,
  allergies,
  medications,
  conditions,
  riskNotes,
  isPregnant,
  isSmoker,
  onAnticoagulants,
}: {
  patientId: string;
  allergies: string[];
  medications: string[];
  conditions: string[];
  riskNotes: string | null;
  isPregnant: boolean | null;
  isSmoker: boolean | null;
  onAnticoagulants: boolean | null;
}): ReactNode {
  const boundAction = updateMedicalProfileAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="allergies" className="text-sm font-medium text-foreground">
            Allergies (une par ligne)
          </label>
          <textarea
            id="allergies"
            name="allergies"
            rows={3}
            defaultValue={allergies.join("\n")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="medications" className="text-sm font-medium text-foreground">
            Médicaments (un par ligne)
          </label>
          <textarea
            id="medications"
            name="medications"
            rows={3}
            defaultValue={medications.join("\n")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="conditions" className="text-sm font-medium text-foreground">
            Conditions (une par ligne)
          </label>
          <textarea
            id="conditions"
            name="conditions"
            rows={3}
            defaultValue={conditions.join("\n")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="riskNotes" className="text-sm font-medium text-foreground">
          Notes de risque
        </label>
        <textarea
          id="riskNotes"
          name="riskNotes"
          rows={2}
          defaultValue={riskNotes ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="isPregnant" defaultChecked={isPregnant ?? false} />
          Grossesse
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="isSmoker" defaultChecked={isSmoker ?? false} />
          Tabagisme
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="onAnticoagulants" defaultChecked={onAnticoagulants ?? false} />
          Anticoagulants
        </label>
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
        {pending ? "Enregistrement…" : "Enregistrer (nouvelle version)"}
      </button>
    </form>
  );
}
