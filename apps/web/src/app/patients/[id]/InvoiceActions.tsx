"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";

import { validateInvoiceAction } from "./actions";

export function ValidateInvoiceButton({ patientId, invoiceId }: { patientId: string; invoiceId: string }): ReactNode {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => validateInvoiceAction(patientId, invoiceId))}
      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
    >
      {isPending ? "Validation…" : "Valider"}
    </button>
  );
}
