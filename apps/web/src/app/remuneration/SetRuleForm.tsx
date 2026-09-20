"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";

import { COMPENSATION_MODEL_DESCRIPTION, COMPENSATION_MODEL_OPTIONS } from "@/lib/compensation";

import { setCompensationRuleAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function SetRuleForm({ practitionerId }: { practitionerId: string }): ReactNode {
  const boundAction = setCompensationRuleAction.bind(null, practitionerId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [model, setModel] = useState("percentage_revenue");

  async function handleAction(formData: FormData): Promise<void> {
    await formAction(formData);
    formRef.current?.reset();
    setModel("percentage_revenue");
  }

  const needsRate = model !== "salary";
  const needsFixedAmount = model === "salary" || model === "hybrid";
  const needsThreshold = model === "hybrid";

  return (
    <form ref={formRef} action={handleAction} className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[240px] flex-col gap-1">
          <label htmlFor="rule-model" className="text-xs font-medium text-muted-foreground">
            Modèle de rémunération
          </label>
          <select
            id="rule-model"
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {COMPENSATION_MODEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {needsRate ? (
          <div className="flex w-28 flex-col gap-1">
            <label htmlFor="rule-ratePercent" className="text-xs font-medium text-muted-foreground">
              Taux (%)
            </label>
            <input
              id="rule-ratePercent"
              name="ratePercent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              required
              placeholder="ex. 40"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </div>
        ) : null}
        {needsFixedAmount ? (
          <div className="flex w-32 flex-col gap-1">
            <label htmlFor="rule-fixedAmount" className="text-xs font-medium text-muted-foreground">
              {model === "salary" ? "Salaire (CHF)" : "Montant fixe (CHF)"}
            </label>
            <input
              id="rule-fixedAmount"
              name="fixedAmount"
              type="number"
              min="0"
              step="0.01"
              required
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </div>
        ) : null}
        {needsThreshold ? (
          <div className="flex w-32 flex-col gap-1">
            <label htmlFor="rule-thresholdAmount" className="text-xs font-medium text-muted-foreground">
              Seuil (CHF)
            </label>
            <input
              id="rule-thresholdAmount"
              name="thresholdAmount"
              type="number"
              min="0"
              step="0.01"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <label htmlFor="rule-validFrom" className="text-xs font-medium text-muted-foreground">
            Prise d&apos;effet
          </label>
          <input
            id="rule-validFrom"
            name="validFrom"
            type="date"
            required
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "…" : "Enregistrer le taux"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{COMPENSATION_MODEL_DESCRIPTION[model]}</p>
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
