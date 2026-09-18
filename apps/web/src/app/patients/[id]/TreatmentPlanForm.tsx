"use client";

import type { ReactNode } from "react";
import { useActionState, useId, useState } from "react";

import { createTreatmentPlanAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface TariffItemOption {
  id: string;
  code: string;
  description: string;
  category: string;
  price: number | null;
}

interface Row {
  key: string;
  tariffItemId: string;
  toothNumber: string;
  quantity: string;
}

function emptyRow(key: string): Row {
  return { key, tariffItemId: "", toothNumber: "", quantity: "1" };
}

function chf(amount: number): string {
  return `CHF ${amount.toFixed(2)}`;
}

function groupByCategory(items: TariffItemOption[]): [string, TariffItemOption[]][] {
  const groups = new Map<string, TariffItemOption[]>();
  for (const item of items) {
    const bucket = groups.get(item.category) ?? [];
    bucket.push(item);
    groups.set(item.category, bucket);
  }
  return Array.from(groups.entries());
}

export function TreatmentPlanForm({
  patientId,
  practitioners,
  tariffItems,
}: {
  patientId: string;
  practitioners: { id: string; name: string }[];
  tariffItems: TariffItemOption[];
}): ReactNode {
  const boundAction = createTreatmentPlanAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [rows, setRows] = useState<Row[]>([emptyRow("row-0")]);
  const idPrefix = useId();
  const groups = groupByCategory(tariffItems);
  const itemsById = new Map(tariffItems.map((item) => [item.id, item]));

  function updateRow(key: string, patch: Partial<Row>): void {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow(): void {
    setRows((current) => [...current, emptyRow(`${idPrefix}-${current.length}-${Date.now()}`)]);
  }

  function removeRow(key: string): void {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  const linesJson = JSON.stringify(
    rows
      .filter((row) => row.tariffItemId)
      .map((row) => ({
        tariffItemId: row.tariffItemId,
        toothNumber: row.toothNumber || undefined,
        quantity: Number(row.quantity) || 1,
      })),
  );

  const total = rows.reduce((sum, row) => {
    const item = itemsById.get(row.tariffItemId);
    if (!item || item.price === null) return sum;
    return sum + item.price * (Number(row.quantity) || 1);
  }, 0);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="tp-practitioner" className="text-xs font-medium text-muted-foreground">
            Praticien
          </label>
          <select
            id="tp-practitioner"
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
        <div className="flex flex-1 min-w-[160px] flex-col gap-1">
          <label htmlFor="tp-label" className="text-xs font-medium text-muted-foreground">
            Intitulé du plan (optionnel)
          </label>
          <input
            id="tp-label"
            name="optionLabel"
            placeholder="ex. Restauration 36"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const selected = itemsById.get(row.tariffItemId);
          const lineTotal = selected?.price != null ? selected.price * (Number(row.quantity) || 1) : null;
          return (
            <div key={row.key} className="flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-2">
              <div className="flex min-w-[240px] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Acte (catalogue tarifaire)</label>
                <select
                  value={row.tariffItemId}
                  onChange={(e) => updateRow(row.key, { tariffItemId: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="">— Choisir un acte —</option>
                  {groups.map(([category, items]) => (
                    <optgroup key={category} label={category}>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} — {item.description}
                          {item.price !== null ? ` (${chf(item.price)})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Dent</label>
                <input
                  type="number"
                  min={11}
                  max={48}
                  value={row.toothNumber}
                  onChange={(e) => updateRow(row.key, { toothNumber: e.target.value })}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Qté</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  className="w-14 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="w-24 pb-1.5 text-right text-sm font-mono text-foreground">
                {lineTotal !== null ? chf(lineTotal) : "—"}
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                Retirer
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          + Ajouter une ligne
        </button>
        <div className="text-sm font-semibold text-foreground">Total : {chf(total)}</div>
      </div>

      <input type="hidden" name="linesJson" value={linesJson} />

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
        {pending ? "Création…" : "Créer le plan de traitement"}
      </button>
    </form>
  );
}
