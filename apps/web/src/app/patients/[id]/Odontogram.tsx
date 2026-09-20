"use client";

import type { DentalConditionType } from "@dentalos/database";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

import { ToothIcon } from "@/components/dental/ToothIcon";
import {
  CONDITION_ORDER,
  CONDITION_STYLE,
  LOWER_LEFT,
  LOWER_RIGHT,
  UPPER_LEFT,
  UPPER_RIGHT,
  toothVariant,
} from "@/lib/dental-conditions";

import { recordToothConditionAction } from "./actions";

function ToothButton({
  toothNumber,
  condition,
  isOpen,
  disabled,
  onToggle,
}: {
  toothNumber: number;
  condition: DentalConditionType;
  isOpen: boolean;
  disabled: boolean;
  onToggle: () => void;
}): ReactNode {
  const style = CONDITION_STYLE[condition];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      title={`Dent ${toothNumber} — ${style.label}`}
      aria-expanded={isOpen}
      className={`flex w-9 flex-col items-center gap-0.5 rounded-md border px-0.5 py-1 text-[10px] font-semibold transition disabled:opacity-60 ${
        isOpen ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
      }`}
    >
      <ToothIcon variant={toothVariant(toothNumber)} fill={style.fill} stroke={style.stroke} dashed={style.dashed} className="h-8 w-5" />
      <span className="text-foreground">{toothNumber}</span>
    </button>
  );
}

function ConditionPopover({
  onSelect,
  onClose,
}: {
  onSelect: (condition: DentalConditionType) => void;
  onClose: () => void;
}): ReactNode {
  return (
    <>
      {/* Backdrop: closes the popover on outside click without pulling in a dependency. */}
      <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden="true" />
      <div className="absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-md border border-border bg-background p-2 shadow-lg">
        <div className="grid grid-cols-3 gap-1">
          {CONDITION_ORDER.map((condition) => {
            const style = CONDITION_STYLE[condition];
            return (
              <button
                key={condition}
                type="button"
                onClick={() => onSelect(condition)}
                className="flex flex-col items-center gap-1 rounded-md p-1.5 text-center hover:bg-muted"
              >
                <span className={`h-4 w-4 rounded-full ${style.chipClass}`} />
                <span className="text-[10px] leading-tight text-foreground">{style.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function Odontogram({
  patientId,
  conditions,
}: {
  patientId: string;
  conditions: Record<number, DentalConditionType>;
}): ReactNode {
  const [isPending, startTransition] = useTransition();
  const [openTooth, setOpenTooth] = useState<number | null>(null);

  function handleSelect(toothNumber: number, condition: DentalConditionType): void {
    setOpenTooth(null);
    startTransition(() => recordToothConditionAction(patientId, toothNumber, condition));
  }

  function renderQuadrant(teeth: number[]): ReactNode {
    return (
      <div className="flex gap-1">
        {teeth.map((tooth) => (
          <div key={tooth} className="relative">
            <ToothButton
              toothNumber={tooth}
              condition={conditions[tooth] ?? "healthy"}
              isOpen={openTooth === tooth}
              disabled={isPending}
              onToggle={() => setOpenTooth((current) => (current === tooth ? null : tooth))}
            />
            {openTooth === tooth ? (
              <ConditionPopover onSelect={(condition) => handleSelect(tooth, condition)} onClose={() => setOpenTooth(null)} />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border p-4">
      <div className="flex items-start gap-3">
        {renderQuadrant(UPPER_RIGHT)}
        <div className="mt-3 h-24 w-px bg-border" />
        {renderQuadrant(UPPER_LEFT)}
      </div>
      <div className="h-px w-full max-w-md bg-border" />
      <div className="flex items-start gap-3">
        {renderQuadrant(LOWER_RIGHT)}
        <div className="mt-3 h-24 w-px bg-border" />
        {renderQuadrant(LOWER_LEFT)}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">Clique une dent pour choisir son état.</p>

      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-border pt-2">
        {CONDITION_ORDER.map((condition) => {
          const style = CONDITION_STYLE[condition];
          return (
            <span key={condition} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`h-2.5 w-2.5 rounded-full ${style.chipClass}`} />
              {style.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
