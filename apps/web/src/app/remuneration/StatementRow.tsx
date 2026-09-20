"use client";

import type { ReactNode } from "react";
import { useActionState, useState, useTransition } from "react";

import { COMPENSATION_STATEMENT_STATUS_CLASS, COMPENSATION_STATEMENT_STATUS_LABEL, formatRate } from "@/lib/compensation";

import {
  markStatementPaidAction,
  setStatementAdjustmentAction,
  validateStatementAction,
  type ActionState,
} from "./actions";

const initialState: ActionState = {};

export interface StatementRowData {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  production: number;
  billed: number;
  collected: number;
  creditNotes: number;
  baseAmount: number;
  rateApplied: number;
  computedAmount: number;
  adjustments: number;
  finalAmount: number;
  status: string;
  notes: string | null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(date);
}

function chf(amount: number): string {
  return `CHF ${amount.toFixed(2)}`;
}

export function StatementRow({ practitionerId, statement }: { practitionerId: string; statement: StatementRowData }): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const boundAdjust = setStatementAdjustmentAction.bind(null, practitionerId, statement.id);
  const [adjustState, adjustFormAction, adjustPending] = useActionState(boundAdjust, initialState);
  const [validatePending, startValidate] = useTransition();
  const [payPending, startPay] = useTransition();

  return (
    <li className="rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-left">
          <span className="font-medium text-foreground">
            {formatDate(statement.periodStart)} → {formatDate(statement.periodEnd)}
          </span>
          <span className="ml-2 font-mono text-foreground">{chf(statement.finalAmount)}</span>
        </button>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COMPENSATION_STATEMENT_STATUS_CLASS[statement.status] ?? "bg-muted"}`}>
            {COMPENSATION_STATEMENT_STATUS_LABEL[statement.status] ?? statement.status}
          </span>
          {statement.status === "draft" ? (
            <button
              type="button"
              disabled={validatePending}
              onClick={() => startValidate(() => validateStatementAction(practitionerId, statement.id))}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {validatePending ? "…" : "Valider"}
            </button>
          ) : null}
          {statement.status === "validated" ? (
            <button
              type="button"
              disabled={payPending}
              onClick={() => startPay(() => markStatementPaidAction(practitionerId, statement.id))}
              className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              {payPending ? "…" : "Marquer payé"}
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            <div>Production : <span className="font-mono text-foreground">{chf(statement.production)}</span></div>
            <div>Facturé : <span className="font-mono text-foreground">{chf(statement.billed)}</span></div>
            <div>Encaissé : <span className="font-mono text-foreground">{chf(statement.collected)}</span></div>
            <div>Avoirs : <span className="font-mono text-foreground">{chf(statement.creditNotes)}</span></div>
          </div>
          <div>
            Base retenue : <span className="font-mono text-foreground">{chf(statement.baseAmount)}</span> × taux{" "}
            <span className="font-mono text-foreground">{formatRate(statement.rateApplied)}</span> ={" "}
            <span className="font-mono text-foreground">{chf(statement.computedAmount)}</span>
          </div>
          {statement.status === "draft" ? (
            <form action={adjustFormAction} className="flex flex-wrap items-end gap-2">
              <div className="flex w-28 flex-col gap-1">
                <label htmlFor={`adj-amount-${statement.id}`} className="text-xs font-medium text-muted-foreground">
                  Ajustement (±)
                </label>
                <input
                  id={`adj-amount-${statement.id}`}
                  name="adjustments"
                  type="number"
                  step="0.01"
                  defaultValue={statement.adjustments}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                />
              </div>
              <div className="flex min-w-[160px] flex-grow flex-col gap-1">
                <label htmlFor={`adj-notes-${statement.id}`} className="text-xs font-medium text-muted-foreground">
                  Motif
                </label>
                <input
                  id={`adj-notes-${statement.id}`}
                  name="notes"
                  defaultValue={statement.notes ?? ""}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                />
              </div>
              <button type="submit" disabled={adjustPending} className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60">
                {adjustPending ? "…" : "Appliquer l'ajustement"}
              </button>
              {adjustState.error ? <span className="text-xs text-red-600">{adjustState.error}</span> : null}
            </form>
          ) : statement.adjustments !== 0 ? (
            <div>
              Ajustement : <span className="font-mono text-foreground">{chf(statement.adjustments)}</span>
              {statement.notes ? ` — ${statement.notes}` : ""}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
