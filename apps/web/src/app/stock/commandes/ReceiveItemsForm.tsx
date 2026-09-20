"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";

import { receivePurchaseOrderItemsAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface ReceivableLine {
  purchaseOrderItemId: string;
  itemName: string;
  unit: string;
  remaining: number;
}

export function ReceiveItemsForm({ poId, lines }: { poId: string; lines: ReceivableLine[] }): ReactNode {
  const boundAction = receivePurchaseOrderItemsAction.bind(null, poId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.purchaseOrderItemId, String(l.remaining)])),
  );

  const linesJson = JSON.stringify(
    lines
      .map((l) => ({ purchaseOrderItemId: l.purchaseOrderItemId, quantityReceived: Number(quantities[l.purchaseOrderItemId]) || 0 }))
      .filter((l) => l.quantityReceived > 0),
  );

  if (lines.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-border p-3">
      <span className="text-xs font-semibold uppercase text-muted-foreground">Réceptionner cette livraison</span>
      {lines.map((line) => (
        <div key={line.purchaseOrderItemId} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-foreground">
            {line.itemName} <span className="text-xs text-muted-foreground">(reste {line.remaining} {line.unit})</span>
          </span>
          <input
            type="number"
            min="0"
            max={line.remaining}
            step="0.001"
            value={quantities[line.purchaseOrderItemId] ?? ""}
            onChange={(e) => setQuantities((prev) => ({ ...prev, [line.purchaseOrderItemId]: e.target.value }))}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="receive-po-lotNumber" className="text-xs font-medium text-muted-foreground">
            N° de lot
          </label>
          <input id="receive-po-lotNumber" name="lotNumber" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="receive-po-expiresAt" className="text-xs font-medium text-muted-foreground">
            Péremption
          </label>
          <input id="receive-po-expiresAt" name="expiresAt" type="date" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </div>
      </div>
      <input type="hidden" name="linesJson" value={linesJson} />
      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "…" : "Enregistrer la réception"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
