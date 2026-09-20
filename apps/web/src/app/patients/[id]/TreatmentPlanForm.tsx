"use client";

import type { DentalConditionType } from "@dentalos/database";
import type { KeyboardEvent, ReactNode } from "react";
import { useActionState, useId, useMemo, useRef, useState } from "react";

import { ToothPickerField } from "@/components/dental/ToothPickerField";
import { TARIFF_PRESETS } from "@/lib/tariff-presets";

import { createTreatmentPlanAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface TariffItemOption {
  id: string;
  code: string;
  description: string;
  category: string;
  points: number | null;
  pointsPrivateMin: number | null;
  pointsPrivateMax: number | null;
  computedPrice: number | null;
}

type Regime = "AAI" | "PRIVATE";

interface Row {
  key: string;
  tariffItemId: string;
  toothNumber: string;
  quantity: string;
}

function chf(amount: number): string {
  return `CHF ${amount.toFixed(2)}`;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Client-side preview only — mirrors packages/database/src/services/tariff-pricing.ts's formula so
 * the running total feels live, but the server always recomputes independently before writing
 * anything (see createTreatmentPlanAction) and never trusts this value. */
function previewPrice(item: TariffItemOption, regime: Regime, pointValue: number): number | null {
  if (item.computedPrice !== null) return item.computedPrice;
  if (regime === "AAI") {
    return item.points !== null ? item.points * pointValue : null;
  }
  const points = item.pointsPrivateMax ?? item.points;
  return points !== null ? points * pointValue : null;
}

function emptyRow(key: string): Row {
  return { key, tariffItemId: "", toothNumber: "", quantity: "1" };
}

export function TreatmentPlanForm({
  patientId,
  practitioners,
  tariffItems,
  conditions,
}: {
  patientId: string;
  practitioners: { id: string; name: string }[];
  tariffItems: TariffItemOption[];
  conditions?: Record<number, DentalConditionType>;
}): ReactNode {
  const boundAction = createTreatmentPlanAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [rows, setRows] = useState<Row[]>([]);
  const [regime, setRegime] = useState<Regime>("AAI");
  const [pointValue, setPointValue] = useState("1.00");
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const idPrefix = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemsById = useMemo(() => new Map(tariffItems.map((item) => [item.id, item])), [tariffItems]);
  const pointValueNumber = Number(pointValue) || 0;

  const suggestions = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    const scored = tariffItems
      .map((item) => {
        const desc = normalize(item.description);
        const code = normalize(item.code);
        let score = -1;
        if (desc.startsWith(q)) score = 0;
        else if (desc.split(/\s+/).some((w) => w.startsWith(q))) score = 1;
        else if (code.startsWith(q)) score = 2;
        else if (desc.includes(q)) score = 3;
        return { item, score };
      })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score || a.item.description.localeCompare(b.item.description));
    return scored.slice(0, 8).map((entry) => entry.item);
  }, [query, tariffItems]);

  function addRow(tariffItemId: string, quantity = 1): void {
    setRows((current) => [
      ...current,
      { key: `${idPrefix}-${current.length}-${Date.now()}-${Math.random()}`, tariffItemId, toothNumber: "", quantity: String(quantity) },
    ]);
  }

  function addFromSearch(item: TariffItemOption): void {
    addRow(item.id);
    setQuery("");
    setHighlighted(0);
    searchInputRef.current?.focus();
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = suggestions[highlighted] ?? suggestions[0];
      if (pick) addFromSearch(pick);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, Math.max(suggestions.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    }
  }

  function applyPreset(label: string): void {
    const preset = TARIFF_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    for (const line of preset.lines) {
      const item = tariffItems.find((i) => i.code === line.code);
      if (item) addRow(item.id, line.quantity ?? 1);
    }
  }

  function updateRow(key: string, patch: Partial<Row>): void {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string): void {
    setRows((current) => current.filter((row) => row.key !== key));
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
    if (!item) return sum;
    const price = previewPrice(item, regime, pointValueNumber);
    return sum + (price ?? 0) * (Number(row.quantity) || 1);
  }, 0);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-border p-3" id="treatment-plan-form">
      <div className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
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
        <div className="flex flex-col gap-1">
          <label htmlFor="tp-regime" className="text-xs font-medium text-muted-foreground">
            Régime tarifaire
          </label>
          <select
            id="tp-regime"
            name="regime"
            value={regime}
            onChange={(e) => setRegime(e.target.value as Regime)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            <option value="AAI">AA/AM/AI (points fixes)</option>
            <option value="PRIVATE">Patient privé — DENTOTAR (plage de points)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tp-point-value" className="text-xs font-medium text-muted-foreground">
            Valeur du point (CHF)
          </label>
          <input
            id="tp-point-value"
            name="pointValue"
            type="number"
            min={0.1}
            max={regime === "PRIVATE" ? 1.7 : 10}
            step={0.01}
            value={pointValue}
            onChange={(e) => setPointValue(e.target.value)}
            className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <p className="max-w-[220px] text-[11px] leading-snug text-muted-foreground">
          {regime === "AAI"
            ? "Valeur nationale fixe depuis 2018 : CHF 1.00."
            : "Plafond SSO pour DENTOTAR : CHF 1.70."}
        </p>
        <div className="flex flex-1 min-w-[160px] flex-col gap-1">
          <label htmlFor="tp-label" className="text-xs font-medium text-muted-foreground">
            Intitulé (optionnel)
          </label>
          <input
            id="tp-label"
            name="optionLabel"
            placeholder="ex. Restauration 36"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex min-w-[280px] flex-1 flex-col gap-1">
          <label htmlFor="tp-search" className="text-xs font-medium text-muted-foreground">
            Ajouter un acte — tape un mot (ex. « composite », « anesth », « digue »), Entrée pour ajouter
          </label>
          <input
            id="tp-search"
            ref={searchInputRef}
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Rechercher dans le tarif SSO (630 positions)…"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
          {suggestions.length > 0 ? (
            <ul className="absolute top-full z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
              {suggestions.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addFromSearch(item)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                      i === highlighted ? "bg-muted" : "hover:bg-muted"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{item.code}</span>
                      {item.description}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {(() => {
                        const p = previewPrice(item, regime, pointValueNumber);
                        return p !== null ? chf(p) : "—";
                      })()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tp-preset" className="text-xs font-medium text-muted-foreground">
            Codes groupés (protocoles courants)
          </label>
          <select
            id="tp-preset"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
              e.target.value = "";
            }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            <option value="" disabled>
              — Choisir un protocole —
            </option>
            {TARIFF_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div id="tp-printable" className="flex flex-col gap-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Code</th>
              <th className="py-1 pr-2 font-medium">Acte</th>
              <th className="py-1 pr-2 font-medium">Dent</th>
              <th className="py-1 pr-2 font-medium">Qté</th>
              <th className="py-1 pr-2 text-right font-medium">Prix</th>
              <th className="py-1 pr-2 font-medium tp-no-print" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const item = itemsById.get(row.tariffItemId);
              if (!item) return null;
              const unitPrice = previewPrice(item, regime, pointValueNumber);
              const qty = Number(row.quantity) || 1;
              return (
                <tr key={row.key} className="border-b border-border/60">
                  <td className="py-1.5 pr-2 font-mono text-xs text-muted-foreground">{item.code}</td>
                  <td className="py-1.5 pr-2 text-foreground">{item.description}</td>
                  <td className="py-1.5 pr-2">
                    <span className="tp-no-print">
                      <ToothPickerField
                        value={row.toothNumber}
                        onChange={(value) => updateRow(row.key, { toothNumber: value })}
                        conditions={conditions}
                        className="min-w-[76px] rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground"
                      />
                    </span>
                    <span className="tp-print-only">{row.toothNumber || "—"}</span>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      className="tp-no-print w-12 rounded-md border border-border bg-background px-1.5 py-1 text-sm text-foreground"
                    />
                    <span className="tp-print-only">{qty}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-foreground">
                    {unitPrice !== null ? chf(unitPrice * qty) : "—"}
                  </td>
                  <td className="py-1.5 pr-2 tp-no-print">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-sm text-muted-foreground">
                  Aucune ligne — recherche un acte ci-dessus ou choisis un protocole.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">
            {regime === "AAI" ? "Régime AA/AM/AI" : "Régime patient privé (DENTOTAR)"} — valeur du point CHF{" "}
            {pointValueNumber.toFixed(2)}
          </span>
          <span className="text-sm font-semibold text-foreground">Total : {chf(total)}</span>
        </div>
      </div>

      <input type="hidden" name="linesJson" value={linesJson} />

      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}

      <div className="tp-no-print flex flex-wrap gap-2">
        <button
          type="submit"
          name="mode"
          value="quote"
          disabled={pending || rows.length === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Création…" : "DEVIS"}
        </button>
        <button
          type="submit"
          name="mode"
          value="treatment"
          disabled={pending || rows.length === 0}
          className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "TRAITEMENT (acte réalisé)"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={rows.length === 0}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40"
        >
          Imprimer le devis
        </button>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #tp-printable, #tp-printable * { visibility: visible; }
          #tp-printable { position: absolute; top: 0; left: 0; width: 100%; }
          .tp-no-print { display: none !important; }
          .tp-print-only { display: inline; }
        }
        .tp-print-only { display: none; }
      `}</style>
    </form>
  );
}
