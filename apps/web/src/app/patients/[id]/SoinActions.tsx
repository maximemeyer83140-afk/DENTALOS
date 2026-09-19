"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";

import { markTreatmentPlanItemCompletedAction } from "./actions";

export function MarkSoinCompletedButton({ patientId, itemId }: { patientId: string; itemId: string }): ReactNode {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => markTreatmentPlanItemCompletedAction(patientId, itemId))}
      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
    >
      Marquer réalisé
    </button>
  );
}
