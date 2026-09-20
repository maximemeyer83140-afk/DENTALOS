"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";

import { cancelPurchaseOrderAction, sendPurchaseOrderAction } from "./actions";

export function SendPurchaseOrderButton({ poId }: { poId: string }): ReactNode {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => sendPurchaseOrderAction(poId))}
      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {isPending ? "…" : "Envoyer au fournisseur"}
    </button>
  );
}

export function CancelPurchaseOrderButton({ poId }: { poId: string }): ReactNode {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => cancelPurchaseOrderAction(poId))}
      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      {isPending ? "…" : "Annuler la commande"}
    </button>
  );
}
