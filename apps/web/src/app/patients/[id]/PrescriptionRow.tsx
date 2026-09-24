"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";

import { updatePrescriptionAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface PrescriptionRowData {
  id: string;
  createdAt: Date;
  practitionerName: string;
  notes: string | null;
  items: { id: string; medication: string; dosage: string; duration: string }[];
}

interface Row {
  key: string;
  medication: string;
  dosage: string;
  duration: string;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

/**
 * Une ordonnance existante s'ouvre directement modifiable — "remplir directement sur KUSP avant
 * impression" (section 79bis) : les champs médicament/posologie/durée sont éditables sur le même
 * rendu que celui envoyé à l'impression, pas dans un formulaire séparé. "Enregistrer" sauvegarde la
 * liste corrigée (updatePrescriptionAction remplace la liste entière) ; "Imprimer" utilise la même
 * technique d'isolation CSS que QuoteRow (voir <style> plus bas) pour n'imprimer que le contenu
 * visible ici, jamais le reste de la page.
 */
export function PrescriptionRow({
  patientId,
  patientName,
  prescription,
}: {
  patientId: string;
  patientName: string;
  prescription: PrescriptionRowData;
}): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const boundAction = updatePrescriptionAction.bind(null, patientId, prescription.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [rows, setRows] = useState<Row[]>(
    prescription.items.map((item, i) => ({
      key: `${prescription.id}-${i}`,
      medication: item.medication,
      dosage: item.dosage,
      duration: item.duration,
    })),
  );
  const [notes, setNotes] = useState(prescription.notes ?? "");
  const printId = `prescription-printable-${prescription.id}`;

  function updateRow(key: string, patch: Partial<Row>): void {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string): void {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  function addRow(): void {
    setRows((current) => [
      ...current,
      { key: `${prescription.id}-${current.length}-${Date.now()}`, medication: "", dosage: "", duration: "" },
    ]);
  }

  const linesJson = JSON.stringify(rows.map(({ medication, dosage, duration }) => ({ medication, dosage, duration })));

  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-medium text-foreground">{prescription.items.map((i) => i.medication).join(", ")}</span>
        <span className="text-xs text-muted-foreground">
          {formatDate(prescription.createdAt)} · {prescription.practitionerName}
        </span>
      </button>

      {expanded ? (
        <form action={formAction} className="mt-3 border-t border-border pt-3">
          <input type="hidden" name="linesJson" value={linesJson} />

          <div id={printId}>
            <div className="mb-2 text-xs text-muted-foreground">
              {patientName} — ordonnance du {formatDate(prescription.createdAt)} — {prescription.practitionerName}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1">Médicament</th>
                  <th className="py-1">Posologie</th>
                  <th className="py-1">Durée</th>
                  <th className="rx-no-print py-1" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-border">
                    <td className="py-1 pr-2">
                      <input
                        value={row.medication}
                        onChange={(e) => updateRow(row.key, { medication: e.target.value })}
                        className="w-full rounded border border-border bg-background px-1.5 py-1 text-foreground"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={row.dosage}
                        onChange={(e) => updateRow(row.key, { dosage: e.target.value })}
                        className="w-full rounded border border-border bg-background px-1.5 py-1 text-foreground"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={row.duration}
                        onChange={(e) => updateRow(row.key, { duration: e.target.value })}
                        className="w-full rounded border border-border bg-background px-1.5 py-1 text-foreground"
                      />
                    </td>
                    <td className="rx-no-print py-1">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <textarea
              value={notes}
              name="notes"
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes (optionnel)"
              className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            />
          </div>

          {state.error ? (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {state.error}
            </p>
          ) : null}

          <div className="rx-no-print mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addRow}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              + Ajouter un médicament
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
            >
              Imprimer
            </button>
          </div>
        </form>
      ) : null}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #${printId}, #${printId} * { visibility: visible; }
          #${printId} { position: absolute; top: 0; left: 0; width: 100%; }
          .rx-no-print { display: none !important; }
          #${printId} input, #${printId} textarea { border: none !important; background: transparent !important; padding: 0 !important; }
        }
      `}</style>
    </li>
  );
}
