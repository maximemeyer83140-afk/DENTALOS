"use client";

import type { ReactNode } from "react";
import { useActionState, useRef } from "react";

import { DOCUMENT_CATEGORY_OPTIONS } from "@/lib/documents";

import { uploadDocumentAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function DocumentUpload({ patientId }: { patientId: string }): ReactNode {
  const boundAction = uploadDocumentAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="doc-file" className="text-xs font-medium text-muted-foreground">
          Fichier
        </label>
        <input
          id="doc-file"
          name="file"
          type="file"
          required
          className="text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1.5 file:text-xs file:font-medium"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="doc-category" className="text-xs font-medium text-muted-foreground">
          Type
        </label>
        <select
          id="doc-category"
          name="category"
          defaultValue="other"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {DOCUMENT_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[200px] flex-grow flex-col gap-1">
        <label htmlFor="doc-comment" className="text-xs font-medium text-muted-foreground">
          Commentaire (facultatif)
        </label>
        <input
          id="doc-comment"
          name="comment"
          placeholder="ex. Radio de contrôle post-extraction"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Ajouter le document"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
