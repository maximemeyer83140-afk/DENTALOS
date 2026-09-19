"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";

import { createCreditNoteAction, type ActionState } from "./actions";
import { ValidateInvoiceButton } from "./InvoiceActions";

const initialState: ActionState = {};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  issued: "Émise",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
  credited: "Créditée",
};

export interface InvoiceRowData {
  id: string;
  invoiceNumber: string;
  status: string;
  createdAt: Date;
  total: string;
  balance: string;
  items: { id: string; description: string; toothNumber: number | null; quantity: number; lineTotal: string }[];
  creditNotes: { id: string; creditNoteNumber: string; amount: string; reason: string | null; issueDate: Date }[];
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function InvoiceRow({ patientId, invoice }: { patientId: string; invoice: InvoiceRowData }): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const boundAction = createCreditNoteAction.bind(null, patientId, invoice.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const canCredit = invoice.status === "issued" || invoice.status === "partially_paid" || invoice.status === "overdue";

  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 text-left">
          <span className="font-mono font-medium text-foreground">{invoice.invoiceNumber}</span>
          <span className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}</span>
          <span className="font-mono">CHF {invoice.total}</span>
          <span className="font-mono text-xs text-muted-foreground">solde CHF {invoice.balance}</span>
          {invoice.status === "draft" ? <ValidateInvoiceButton patientId={patientId} invoiceId={invoice.id} /> : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">Acte</th>
                <th className="py-1">Dent</th>
                <th className="py-1">Qté</th>
                <th className="py-1 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-1 text-foreground">{item.description}</td>
                  <td className="py-1 text-muted-foreground">{item.toothNumber ?? "—"}</td>
                  <td className="py-1 text-muted-foreground">{item.quantity}</td>
                  <td className="py-1 text-right font-mono">CHF {item.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {invoice.creditNotes.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Avoirs</p>
              <ul className="flex flex-col gap-1">
                {invoice.creditNotes.map((cn) => (
                  <li key={cn.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{cn.creditNoteNumber}</span>
                    <span className="text-muted-foreground">{cn.reason ?? "—"}</span>
                    <span className="font-mono">CHF {cn.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canCredit ? (
            showCreditForm ? (
              <form action={formAction} className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`credit-amount-${invoice.id}`} className="text-xs font-medium text-muted-foreground">
                    Montant de l&apos;avoir
                  </label>
                  <input
                    id={`credit-amount-${invoice.id}`}
                    name="amount"
                    type="number"
                    step="0.05"
                    min="0"
                    max={invoice.balance}
                    className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <label htmlFor={`credit-reason-${invoice.id}`} className="text-xs font-medium text-muted-foreground">
                    Motif
                  </label>
                  <input
                    id={`credit-reason-${invoice.id}`}
                    name="reason"
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                >
                  {pending ? "…" : "Émettre l'avoir"}
                </button>
                {state.error ? (
                  <p role="alert" className="w-full text-xs text-red-600">
                    {state.error}
                  </p>
                ) : null}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreditForm(true)}
                className="self-start rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                Émettre un avoir
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
