"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";

import { createLaboratoryAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function CreateLaboratoryForm(): ReactNode {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createLaboratoryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        + Nouveau laboratoire
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="lab-name" className="text-xs font-medium text-muted-foreground">
          Nom
        </label>
        <input id="lab-name" name="name" required className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="lab-phone" className="text-xs font-medium text-muted-foreground">
          Téléphone
        </label>
        <input id="lab-phone" name="phone" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="lab-email" className="text-xs font-medium text-muted-foreground">
          Email
        </label>
        <input id="lab-email" name="email" type="email" className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {pending ? "…" : "Créer"}
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
