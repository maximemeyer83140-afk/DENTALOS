"use client";

import type { DentalConditionType } from "@dentalos/database";
import type { ReactNode } from "react";
import { useTransition } from "react";

import { recordToothConditionAction } from "./actions";

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const CONDITION_CYCLE: DentalConditionType[] = ["healthy", "caries", "composite", "crown", "implant", "missing"];

const CONDITION_LABEL: Record<DentalConditionType, string> = {
  healthy: "Saine",
  missing: "Absente",
  caries: "Carie",
  composite: "Composite",
  amalgam: "Amalgame",
  crown: "Couronne",
  bridge: "Bridge",
  implant: "Implant",
  planned_extraction: "Extraction prévue",
  endodontics: "Endodontie",
  lesion: "Lésion",
  veneer: "Facette",
  inlay: "Inlay",
  onlay: "Onlay",
  provisional: "Provisoire",
};

const CONDITION_CLASS: Partial<Record<DentalConditionType, string>> = {
  caries: "border-red-400 bg-red-50 text-red-700",
  composite: "border-blue-400 bg-blue-50 text-blue-700",
  crown: "border-primary bg-primary text-primary-foreground",
  implant: "border-green-400 bg-green-50 text-green-700",
  missing: "border-dashed border-muted-foreground bg-muted text-muted-foreground",
};

export function Odontogram({
  patientId,
  conditions,
}: {
  patientId: string;
  conditions: Record<number, DentalConditionType>;
}): ReactNode {
  const [isPending, startTransition] = useTransition();

  function handleClick(toothNumber: number) {
    const current = conditions[toothNumber] ?? "healthy";
    const currentIndex = CONDITION_CYCLE.indexOf(current);
    const next = CONDITION_CYCLE[(currentIndex + 1) % CONDITION_CYCLE.length]!;
    startTransition(() => recordToothConditionAction(patientId, toothNumber, next));
  }

  function renderRow(teeth: number[]): ReactNode {
    return (
      <div className="flex flex-wrap gap-1">
        {teeth.map((tooth) => {
          const condition = conditions[tooth] ?? "healthy";
          return (
            <button
              key={tooth}
              type="button"
              disabled={isPending}
              onClick={() => handleClick(tooth)}
              title={`Dent ${tooth} — ${CONDITION_LABEL[condition]}`}
              className={`flex h-9 w-9 flex-col items-center justify-center rounded-md border text-[10px] font-semibold disabled:opacity-60 ${
                CONDITION_CLASS[condition] ?? "border-border bg-background text-foreground"
              }`}
            >
              {tooth}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border p-4">
      {renderRow(UPPER_TEETH)}
      {renderRow(LOWER_TEETH)}
      <p className="mt-2 text-xs text-muted-foreground">Clique une dent pour faire évoluer son état.</p>
    </div>
  );
}
