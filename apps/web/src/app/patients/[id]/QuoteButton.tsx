"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";

import { createQuoteAction } from "./actions";

export function QuoteButton({ patientId, treatmentPlanOptionId }: { patientId: string; treatmentPlanOptionId: string }): ReactNode {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => createQuoteAction(patientId, treatmentPlanOptionId))}
      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
    >
      {isPending ? "Création…" : "Créer un devis"}
    </button>
  );
}
