"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";

import { INVENTORY_CATEGORY_OPTIONS } from "@/lib/inventory";

import { createInventoryItemAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface SupplierOption {
  id: string;
  name: string;
}

export function CreateItemForm({ suppliers }: { suppliers: SupplierOption[] }): ReactNode {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createInventoryItemAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
      >
        + Nouvel article
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="item-sku" className="text-xs font-medium text-muted-foreground">
          Référence (SKU)
        </label>
        <input id="item-sku" name="sku" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex min-w-[180px] flex-col gap-1">
        <label htmlFor="item-name" className="text-xs font-medium text-muted-foreground">
          Nom
        </label>
        <input id="item-name" name="name" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="item-category" className="text-xs font-medium text-muted-foreground">
          Catégorie
        </label>
        <select id="item-category" name="category" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          {INVENTORY_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="item-supplier" className="text-xs font-medium text-muted-foreground">
          Fournisseur
        </label>
        <select id="item-supplier" name="supplierId" defaultValue="" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          <option value="">—</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex w-24 flex-col gap-1">
        <label htmlFor="item-costPrice" className="text-xs font-medium text-muted-foreground">
          Prix d&apos;achat
        </label>
        <input
          id="item-costPrice"
          name="costPrice"
          type="number"
          step="0.01"
          min="0"
          required
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <div className="flex w-28 flex-col gap-1">
        <label htmlFor="item-reorderThreshold" className="text-xs font-medium text-muted-foreground">
          Seuil d&apos;alerte
        </label>
        <input
          id="item-reorderThreshold"
          name="reorderThreshold"
          type="number"
          min="0"
          defaultValue={0}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "…" : "Créer l'article"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
        Annuler
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
