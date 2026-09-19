"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { CONSENT_TEMPLATE_OPTIONS } from "@/lib/consents";

import { createConsentAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function ConsentForm({ patientId }: { patientId: string }): ReactNode {
  const boundAction = createConsentAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex min-w-[220px] flex-col gap-1">
        <label htmlFor="consent-templateKey" className="text-xs font-medium text-muted-foreground">
          Type de consentement
        </label>
        <select
          id="consent-templateKey"
          name="templateKey"
          defaultValue="consentement_general"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {CONSENT_TEMPLATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "…" : "Demander le consentement"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
