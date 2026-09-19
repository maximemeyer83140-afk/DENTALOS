"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { createInvoiceFromTreatmentsAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface UnbilledSoinData {
  treatmentId: string;
  description: string;
  toothNumber: number | null;
  performedAt: Date | null;
  amount: number;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

/** ÉTAPE 8 : "soins réalisés non facturés" — une case par acte, on sélectionne ceux à regrouper
 * dans une même facture (`createInvoiceFromTreatmentsAction`). */
export function UnbilledSoinsForm({ patientId, soins }: { patientId: string; soins: UnbilledSoinData[] }): ReactNode {
  const boundAction = createInvoiceFromTreatmentsAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (soins.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun soin réalisé en attente de facturation.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {soins.map((soin) => (
          <li key={soin.treatmentId} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <input type="checkbox" name="treatmentId" value={soin.treatmentId} />
            <span className="flex-1 text-foreground">
              {soin.description}
              {soin.toothNumber ? ` (dent ${soin.toothNumber})` : ""}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(soin.performedAt)}</span>
            <span className="font-mono">CHF {soin.amount.toFixed(2)}</span>
          </li>
        ))}
      </ul>
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
        {pending ? "Facturation…" : "Facturer la sélection"}
      </button>
    </form>
  );
}
