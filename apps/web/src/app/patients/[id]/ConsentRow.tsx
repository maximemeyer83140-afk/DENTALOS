"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";

import { CONSENT_STATUS_CLASS, CONSENT_STATUS_LABEL, CONSENT_TEMPLATE_LABEL } from "@/lib/consents";

import { recordConsentDecisionAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface ConsentRowData {
  id: string;
  templateKey: string;
  version: number;
  status: string;
  signedAt: Date | null;
  signedByName: string | null;
  createdAt: Date;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

export function ConsentRow({ patientId, consent }: { patientId: string; consent: ConsentRowData }): ReactNode {
  const [deciding, setDeciding] = useState(false);
  const boundAction = recordConsentDecisionAction.bind(null, patientId, consent.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-foreground">
            {CONSENT_TEMPLATE_LABEL[consent.templateKey] ?? consent.templateKey}
            {consent.version > 1 ? ` (v${consent.version})` : ""}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            Demandé le {formatDate(consent.createdAt)}
            {consent.signedAt ? ` · décidé le ${formatDate(consent.signedAt)}` : ""}
            {consent.signedByName ? ` · ${consent.signedByName}` : ""}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CONSENT_STATUS_CLASS[consent.status] ?? "bg-muted"}`}>
            {CONSENT_STATUS_LABEL[consent.status] ?? consent.status}
          </span>
          {consent.status === "pending" ? (
            <button type="button" onClick={() => setDeciding((v) => !v)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              {deciding ? "Fermer" : "Enregistrer la décision"}
            </button>
          ) : null}
        </div>
      </div>

      {deciding ? (
        <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`signedByName-${consent.id}`} className="text-xs font-medium text-muted-foreground">
              Signé par
            </label>
            <input
              id={`signedByName-${consent.id}`}
              name="signedByName"
              placeholder="Nom du patient / représentant légal"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            name="status"
            value="signed"
            disabled={pending}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {pending ? "…" : "Signé"}
          </button>
          <button
            type="submit"
            name="status"
            value="declined"
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {pending ? "…" : "Refusé"}
          </button>
          {state.error ? (
            <p role="alert" className="w-full text-xs text-red-600">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
