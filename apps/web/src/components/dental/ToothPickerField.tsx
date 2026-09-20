"use client";

import type { DentalConditionType } from "@dentalos/database";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  CONDITION_STYLE,
  LOWER_LEFT,
  LOWER_RIGHT,
  UPPER_LEFT,
  UPPER_RIGHT,
  toothVariant,
} from "@/lib/dental-conditions";

import { ToothIcon } from "./ToothIcon";

/**
 * Replaces a plain `<input type="number">` for "which tooth" — a practitioner recognizes a tooth
 * by where it sits in the arch far faster than by recalling its FDI code from memory. If
 * `conditions` is passed (the patient's current odontogram), each tooth in the picker is colored
 * the same way the odontogram shows it, so picking "dent 26" also surfaces "she already has a
 * carie there" without a second lookup.
 */
export function ToothPickerField({
  value,
  onChange,
  conditions,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  conditions?: Record<number, DentalConditionType>;
  id?: string;
  className?: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const selected = value ? Number(value) : null;

  function renderQuadrant(teeth: number[]): ReactNode {
    return (
      <div className="flex gap-0.5">
        {teeth.map((tooth) => {
          const style = CONDITION_STYLE[conditions?.[tooth] ?? "healthy"];
          return (
            <button
              key={tooth}
              type="button"
              onClick={() => {
                onChange(String(tooth));
                setOpen(false);
              }}
              title={`Dent ${tooth}`}
              className={`flex flex-col items-center rounded p-0.5 ${
                selected === tooth ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
              }`}
            >
              <ToothIcon variant={toothVariant(tooth)} fill={style.fill} stroke={style.stroke} dashed={style.dashed} className="h-6 w-4" />
              <span className="text-[9px] text-foreground">{tooth}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={className ?? "min-w-[64px] rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"}
      >
        {selected ? `Dent ${selected}` : "Choisir…"}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-border bg-background p-2 shadow-lg">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-start gap-2">
                {renderQuadrant(UPPER_RIGHT)}
                <div className="mt-2 h-6 w-px bg-border" />
                {renderQuadrant(UPPER_LEFT)}
              </div>
              <div className="h-px w-full bg-border" />
              <div className="flex items-start gap-2">
                {renderQuadrant(LOWER_RIGHT)}
                <div className="mt-2 h-6 w-px bg-border" />
                {renderQuadrant(LOWER_LEFT)}
              </div>
            </div>
            {selected ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Effacer
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
