"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { recordPaymentAction, type ActionState } from "./actions";

const initialState: ActionState = {};

const METHOD_LABEL: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  twint: "TWINT",
  bank_transfer: "Virement",
  qr_bill: "QR-facture",
  other: "Autre",
};

export function PaymentForm({
  patientId,
  invoices,
}: {
  patientId: string;
  invoices: { id: string; invoiceNumber: string; balance: string }[];
}): ReactNode {
  const boundAction = recordPaymentAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (invoices.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap gap-2">
        <select
          name="invoiceId"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {invoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.invoiceNumber} — solde CHF {invoice.balance}
            </option>
          ))}
        </select>
        <input
          type="number"
          name="amount"
          step="0.05"
          min="0"
          placeholder="Montant"
          className="w-28 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          name="method"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {Object.entries(METHOD_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="reference"
          placeholder="Référence (optionnel)"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
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
        {pending ? "Enregistrement…" : "Enregistrer le paiement"}
      </button>
    </form>
  );
}
