"use client";

import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import { adjustStockAction, consumeStockAction, receiveStockAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function ReceiveStockForm({ itemId }: { itemId: string }): ReactNode {
  const boundAction = receiveStockAction.bind(null, itemId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <span className="text-xs font-semibold uppercase text-muted-foreground">Réceptionner</span>
      <div className="flex w-24 flex-col gap-1">
        <label htmlFor="receive-quantity" className="text-xs font-medium text-muted-foreground">
          Quantité
        </label>
        <input id="receive-quantity" name="quantity" type="number" step="0.001" min="0" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="receive-lotNumber" className="text-xs font-medium text-muted-foreground">
          N° de lot
        </label>
        <input id="receive-lotNumber" name="lotNumber" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="receive-expiresAt" className="text-xs font-medium text-muted-foreground">
          Péremption
        </label>
        <input id="receive-expiresAt" name="expiresAt" type="date" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "…" : "Réceptionner"}
      </button>
      {state.error ? <p role="alert" className="w-full text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function ConsumeStockForm({ itemId }: { itemId: string }): ReactNode {
  const boundAction = consumeStockAction.bind(null, itemId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <span className="text-xs font-semibold uppercase text-muted-foreground">Consommer</span>
      <div className="flex w-24 flex-col gap-1">
        <label htmlFor="consume-quantity" className="text-xs font-medium text-muted-foreground">
          Quantité
        </label>
        <input id="consume-quantity" name="quantity" type="number" step="0.001" min="0" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex min-w-[180px] flex-grow flex-col gap-1">
        <label htmlFor="consume-reason" className="text-xs font-medium text-muted-foreground">
          Motif (facultatif)
        </label>
        <input id="consume-reason" name="reason" placeholder="ex. Séance patient" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {pending ? "…" : "Consommer"}
      </button>
      {state.error ? <p role="alert" className="w-full text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function AdjustStockForm({ itemId }: { itemId: string }): ReactNode {
  const boundAction = adjustStockAction.bind(null, itemId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <span className="text-xs font-semibold uppercase text-muted-foreground">Ajuster</span>
      <div className="flex w-28 flex-col gap-1">
        <label htmlFor="adjust-delta" className="text-xs font-medium text-muted-foreground">
          Correction (± )
        </label>
        <input id="adjust-delta" name="delta" type="number" step="0.001" required placeholder="ex. -2 ou 5" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex min-w-[180px] flex-grow flex-col gap-1">
        <label htmlFor="adjust-reason" className="text-xs font-medium text-muted-foreground">
          Motif
        </label>
        <input id="adjust-reason" name="reason" required placeholder="ex. Inventaire physique, casse" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60">
        {pending ? "…" : "Ajuster"}
      </button>
      {state.error ? <p role="alert" className="w-full text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
