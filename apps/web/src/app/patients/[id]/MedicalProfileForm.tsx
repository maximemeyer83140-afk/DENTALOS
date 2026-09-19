"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";

import { isDentalRelevantMedication, PATHOLOGY_DEFS } from "@/lib/anamnese";

import { updateMedicalProfileAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface PathologyEntry {
  present: boolean;
  notes?: string;
}

export interface MedicationEntry {
  name: string;
  dose?: string;
  frequency?: string;
  comment?: string;
}

interface MedicationRow extends MedicationEntry {
  key: string;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function MedicalProfileForm({
  patientId,
  pathologies,
  medications,
  allergies,
  pastSurgeries,
  treatingPhysician,
  riskNotes,
  isPregnant,
  isSmoker,
  alcoholUse,
  onAnticoagulants,
  onAntiplatelets,
  updatedAt,
  updatedBy,
  version,
}: {
  patientId: string;
  pathologies: Record<string, PathologyEntry>;
  medications: MedicationEntry[];
  allergies: string[];
  pastSurgeries: string[];
  treatingPhysician: string | null;
  riskNotes: string | null;
  isPregnant: boolean | null;
  isSmoker: boolean | null;
  alcoholUse: boolean | null;
  onAnticoagulants: boolean | null;
  onAntiplatelets: boolean | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  version: number;
}): ReactNode {
  const boundAction = updateMedicalProfileAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const rowKeySeq = useRef(0);
  const [medRows, setMedRows] = useState<MedicationRow[]>(() =>
    medications.length > 0
      ? medications.map((m) => ({ ...m, key: `m${rowKeySeq.current++}` }))
      : [{ key: `m${rowKeySeq.current++}`, name: "" }],
  );

  function addMedRow(): void {
    setMedRows((rows) => [...rows, { key: `m${rowKeySeq.current++}`, name: "" }]);
  }
  function removeMedRow(key: string): void {
    setMedRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {updatedAt ? (
        <p className="text-xs text-muted-foreground">
          Dernière mise à jour : {formatDateTime(updatedAt)}
          {updatedBy ? ` par ${updatedBy}` : ""} — version {version}.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Anamnèse jamais renseignée pour ce patient.</p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Pathologies / antécédents</h3>
        <div className="flex flex-col gap-2">
          {PATHOLOGY_DEFS.map((def) => (
            <div key={def.code} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
              <label className="flex min-w-[220px] items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name={`path_${def.code}`} defaultChecked={pathologies[def.code]?.present ?? false} />
                {def.label}
              </label>
              <input
                type="text"
                name={`path_${def.code}_notes`}
                placeholder="Précisions (facultatif)"
                defaultValue={pathologies[def.code]?.notes ?? ""}
                className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Médicaments</h3>
          <button type="button" onClick={addMedRow} className="text-xs font-medium text-primary hover:underline">
            + Ajouter un médicament
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {medRows.map((row) => (
            <div key={row.key} className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 sm:grid-cols-[2fr_1fr_1fr_2fr_auto]">
              <input
                type="text"
                name="medName"
                placeholder="Nom du médicament"
                defaultValue={row.name}
                className={`rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary ${
                  row.name && isDentalRelevantMedication(row.name) ? "border-amber-400 bg-amber-50" : ""
                }`}
              />
              <input
                type="text"
                name="medDose"
                placeholder="Dose"
                defaultValue={row.dose ?? ""}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                name="medFrequency"
                placeholder="Fréquence"
                defaultValue={row.frequency ?? ""}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                name="medComment"
                placeholder="Commentaire"
                defaultValue={row.comment ?? ""}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => removeMedRow(row.key)}
                className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-red-600"
                aria-label="Retirer ce médicament"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Surligné en ambre : catégorie à vérifier avant un acte (anticoagulant, corticoïde, bisphosphonate…) —
          simple repère visuel, la décision clinique reste au praticien.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="allergies" className="text-sm font-medium text-foreground">
            Allergies médicamenteuses (une par ligne)
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
          <label htmlFor="pastSurgeries" className="text-sm font-medium text-foreground">
            Interventions chirurgicales (une par ligne)
          </label>
          <textarea
            id="pastSurgeries"
            name="pastSurgeries"
            rows={3}
            defaultValue={pastSurgeries.join("\n")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="treatingPhysician" className="text-sm font-medium text-foreground">
          Médecin traitant
        </label>
        <input
          id="treatingPhysician"
          name="treatingPhysician"
          type="text"
          defaultValue={treatingPhysician ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="riskNotes" className="text-sm font-medium text-foreground">
          Commentaires
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
          <input type="checkbox" name="onAnticoagulants" defaultChecked={onAnticoagulants ?? false} />
          Anticoagulants
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="onAntiplatelets" defaultChecked={onAntiplatelets ?? false} />
          Antiagrégants
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="isPregnant" defaultChecked={isPregnant ?? false} />
          Grossesse
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="isSmoker" defaultChecked={isSmoker ?? false} />
          Tabac
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="alcoholUse" defaultChecked={alcoholUse ?? false} />
          Alcool
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
