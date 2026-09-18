"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { createNoteAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function NoteForm({
  patientId,
  practitioners,
}: {
  patientId: string;
  practitioners: { id: string; name: string }[];
}): ReactNode {
  const boundAction = createNoteAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex gap-2">
        <select
          name="practitionerId"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {practitioners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <textarea
        name="content"
        rows={3}
        placeholder="Note de consultation…"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
      />
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Ajout…" : "Ajouter la note"}
      </button>
    </form>
  );
}
