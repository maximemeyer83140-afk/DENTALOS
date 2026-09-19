"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";

import { createInvoiceAction, updateQuoteStatusAction } from "./actions";

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  partially_accepted: "Partiellement accepté",
  rejected: "Refusé",
  expired: "Expiré",
};

const QUOTE_STATUS_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 text-blue-700",
  accepted: "bg-green-50 text-green-700",
  partially_accepted: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-700",
  expired: "bg-muted text-muted-foreground",
};

export interface QuoteRowData {
  id: string;
  quoteNumber: string;
  status: string;
  createdAt: Date;
  total: string;
  items: { id: string; description: string; toothNumber: number | null; quantity: number; unitPrice: string; lineTotal: string }[];
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function QuoteRow({ patientId, quote }: { patientId: string; quote: QuoteRowData }): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const printId = `quote-printable-${quote.id}`;

  function setStatus(status: "sent" | "accepted" | "partially_accepted" | "rejected"): void {
    startTransition(() => updateQuoteStatusAction(patientId, quote.id, status));
  }

  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 text-left">
          <span className="font-mono font-medium text-foreground">{quote.quoteNumber}</span>
          <span className="text-xs text-muted-foreground">{formatDate(quote.createdAt)}</span>
        </button>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${QUOTE_STATUS_CLASS[quote.status] ?? "bg-muted"}`}>
            {QUOTE_STATUS_LABEL[quote.status] ?? quote.status}
          </span>
          <span className="font-mono">CHF {quote.total}</span>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 border-t border-border pt-3" id={printId}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">Acte</th>
                <th className="py-1">Dent</th>
                <th className="py-1">Qté</th>
                <th className="py-1 text-right">Prix</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-1 text-foreground">{item.description}</td>
                  <td className="py-1 text-muted-foreground">{item.toothNumber ?? "—"}</td>
                  <td className="py-1 text-muted-foreground">{item.quantity}</td>
                  <td className="py-1 text-right font-mono">CHF {item.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="quote-no-print mt-3 flex flex-wrap gap-2">
            {quote.status === "draft" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setStatus("sent")}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
              >
                Marquer envoyé
              </button>
            ) : null}
            {quote.status === "draft" || quote.status === "sent" ? (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setStatus("accepted")}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
                >
                  Accepté
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setStatus("partially_accepted")}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
                >
                  Partiellement accepté
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setStatus("rejected")}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
                >
                  Refusé
                </button>
              </>
            ) : null}
            {quote.status === "accepted" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => createInvoiceAction(patientId, quote.id))}
                className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                Facturer
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              Imprimer
            </button>
          </div>
        </div>
      ) : null}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #${printId}, #${printId} * { visibility: visible; }
          #${printId} { position: absolute; top: 0; left: 0; width: 100%; }
          .quote-no-print { display: none !important; }
        }
      `}</style>
    </li>
  );
}
