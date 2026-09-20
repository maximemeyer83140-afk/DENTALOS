"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import { LAB_WORK_TYPE_PRESETS } from "@/lib/laboratory";

import { createLabCaseAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface PractitionerOption {
  id: string;
  name: string;
}

export interface LaboratoryOption {
  id: string;
  name: string;
}

export function LabCaseForm({
  patientId,
  practitioners,
  laboratories,
}: {
  patientId: string;
  practitioners: PractitionerOption[];
  laboratories: LaboratoryOption[];
}): ReactNode {
  const boundAction = createLabCaseAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  if (laboratories.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aucun laboratoire enregistré — ajoute-en un depuis <Link href="/laboratoire" className="text-primary hover:underline">/laboratoire</Link> avant d&apos;envoyer un travail.
      </p>
    );
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex min-w-[160px] flex-col gap-1">
        <label htmlFor="labcase-workType" className="text-xs font-medium text-muted-foreground">
          Travail
        </label>
        <input
          id="labcase-workType"
          name="workType"
          list="labcase-workType-presets"
          required
          placeholder="ex. Couronne céramique"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <datalist id="labcase-workType-presets">
          {LAB_WORK_TYPE_PRESETS.map((preset) => (
            <option key={preset} value={preset} />
          ))}
        </datalist>
      </div>
      <div className="flex w-20 flex-col gap-1">
        <label htmlFor="labcase-toothNumber" className="text-xs font-medium text-muted-foreground">
          Dent
        </label>
        <input id="labcase-toothNumber" name="toothNumber" type="number" min="11" max="48" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="labcase-practitionerId" className="text-xs font-medium text-muted-foreground">
          Praticien
        </label>
        <select id="labcase-practitionerId" name="practitionerId" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          {practitioners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="labcase-laboratoryId" className="text-xs font-medium text-muted-foreground">
          Laboratoire
        </label>
        <select id="labcase-laboratoryId" name="laboratoryId" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          {laboratories.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="labcase-expectedAt" className="text-xs font-medium text-muted-foreground">
          Retour attendu
        </label>
        <input id="labcase-expectedAt" name="expectedAt" type="date" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex w-24 flex-col gap-1">
        <label htmlFor="labcase-cost" className="text-xs font-medium text-muted-foreground">
          Coût
        </label>
        <input id="labcase-cost" name="cost" type="number" step="0.01" min="0" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {pending ? "…" : "Envoyer au laboratoire"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
