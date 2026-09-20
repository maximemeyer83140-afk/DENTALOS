"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";

import { createPurchaseOrderAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface SupplierOption {
  id: string;
  name: string;
}

export interface ItemOption {
  id: string;
  name: string;
  sku: string;
  unit: string;
}

interface Row {
  key: string;
  inventoryItemId: string;
  quantityOrdered: string;
  unitCost: string;
}

function emptyRow(key: string): Row {
  return { key, inventoryItemId: "", quantityOrdered: "1", unitCost: "" };
}

export function CreatePurchaseOrderForm({ suppliers, items }: { suppliers: SupplierOption[]; items: ItemOption[] }): ReactNode {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow("row-0")]);
  const [state, formAction, pending] = useActionState(createPurchaseOrderAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const nextKey = useRef(1);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
    setRows([emptyRow("row-0")]);
    setOpen(false);
  }

  function updateRow(key: string, patch: Partial<Row>): void {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const linesJson = JSON.stringify(
    rows
      .filter((r) => r.inventoryItemId)
      .map((r) => ({
        inventoryItemId: r.inventoryItemId,
        quantityOrdered: Number(r.quantityOrdered) || 0,
        unitCost: Number(r.unitCost) || 0,
      })),
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
        + Nouveau bon de commande
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="po-supplier" className="text-xs font-medium text-muted-foreground">
            Fournisseur
          </label>
          <select id="po-supplier" name="supplierId" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="po-expectedAt" className="text-xs font-medium text-muted-foreground">
            Livraison attendue
          </label>
          <input id="po-expectedAt" name="expectedAt" type="date" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
          Annuler
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[200px] flex-grow flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Article</label>
              <select
                value={row.inventoryItemId}
                onChange={(e) => updateRow(row.key, { inventoryItemId: e.target.value })}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">—</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-24 flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Quantité</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={row.quantityOrdered}
                onChange={(e) => updateRow(row.key, { quantityOrdered: e.target.value })}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="flex w-24 flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Prix unitaire</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.unitCost}
                onChange={(e) => updateRow(row.key, { unitCost: e.target.value })}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <button
              type="button"
              onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== row.key) : prev))}
              className="text-xs text-muted-foreground hover:text-red-600"
            >
              Retirer
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const key = `row-${nextKey.current++}`;
            setRows((prev) => [...prev, emptyRow(key)]);
          }}
          className="self-start text-xs font-medium text-primary hover:underline"
        >
          + Ajouter une ligne
        </button>
      </div>

      <input type="hidden" name="linesJson" value={linesJson} />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "…" : "Créer le bon de commande"}
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
