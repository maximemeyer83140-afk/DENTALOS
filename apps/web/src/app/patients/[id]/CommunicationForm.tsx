"use client";

import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import { COMMUNICATION_CHANNEL_OPTIONS } from "@/lib/recalls";

import { logCommunicationAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function CommunicationForm({ patientId }: { patientId: string }): ReactNode {
  const boundAction = logCommunicationAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="comm-channel" className="text-xs font-medium text-muted-foreground">
          Canal
        </label>
        <select
          id="comm-channel"
          name="channel"
          defaultValue="call"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {COMMUNICATION_CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[160px] flex-col gap-1">
        <label htmlFor="comm-subject" className="text-xs font-medium text-muted-foreground">
          Sujet
        </label>
        <input
          id="comm-subject"
          name="subject"
          placeholder="ex. Rappel RDV, relance devis"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="flex min-w-[200px] flex-grow flex-col gap-1">
        <label htmlFor="comm-content" className="text-xs font-medium text-muted-foreground">
          Détail
        </label>
        <input
          id="comm-content"
          name="content"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "…" : "Enregistrer le contact"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
