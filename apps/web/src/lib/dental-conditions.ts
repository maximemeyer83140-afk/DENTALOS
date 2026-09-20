import type { DentalConditionType } from "@dentalos/database";

/** Single source of truth for how a tooth condition reads across the app — the odontogram
 * (`components/dental/ToothIcon.tsx`) and the tooth picker used in the treatment plan both draw
 * from this so a "carie" never looks different depending on where it's shown. */
export interface ConditionStyle {
  label: string;
  /** SVG fill for the tooth shape. */
  fill: string;
  /** SVG stroke (outline). */
  stroke: string;
  /** Swatch color for chips/legends outside the SVG (Tailwind classes). */
  chipClass: string;
  /** `missing`/`planned_extraction` render with a dashed outline — the tooth isn't (or won't be)
   * really there. */
  dashed?: boolean;
}

export const CONDITION_STYLE: Record<DentalConditionType, ConditionStyle> = {
  healthy: { label: "Saine", fill: "#ffffff", stroke: "#cbd5e1", chipClass: "bg-white border border-slate-300" },
  caries: { label: "Carie", fill: "#f87171", stroke: "#b91c1c", chipClass: "bg-red-400" },
  composite: { label: "Composite", fill: "#93c5fd", stroke: "#1d4ed8", chipClass: "bg-blue-300" },
  amalgam: { label: "Amalgame", fill: "#94a3b8", stroke: "#334155", chipClass: "bg-slate-400" },
  crown: { label: "Couronne", fill: "#fbbf24", stroke: "#92400e", chipClass: "bg-amber-400" },
  bridge: { label: "Bridge", fill: "#c4b5fd", stroke: "#5b21b6", chipClass: "bg-violet-300" },
  implant: { label: "Implant", fill: "#86efac", stroke: "#15803d", chipClass: "bg-green-300" },
  planned_extraction: {
    label: "Extraction prévue",
    fill: "#fdba74",
    stroke: "#c2410c",
    chipClass: "bg-orange-300",
    dashed: true,
  },
  endodontics: { label: "Endodontie", fill: "#f0abfc", stroke: "#a21caf", chipClass: "bg-fuchsia-300" },
  lesion: { label: "Lésion", fill: "#bef264", stroke: "#4d7c0f", chipClass: "bg-lime-300" },
  veneer: { label: "Facette", fill: "#67e8f9", stroke: "#0e7490", chipClass: "bg-cyan-300" },
  inlay: { label: "Inlay", fill: "#5eead4", stroke: "#0f766e", chipClass: "bg-teal-300" },
  onlay: { label: "Onlay", fill: "#a5b4fc", stroke: "#3730a3", chipClass: "bg-indigo-300" },
  provisional: { label: "Provisoire", fill: "#fde68a", stroke: "#a16207", chipClass: "bg-yellow-300" },
  missing: {
    label: "Absente",
    fill: "none",
    stroke: "#94a3b8",
    chipClass: "border border-dashed border-slate-400 bg-transparent",
    dashed: true,
  },
};

/** Every condition, in a stable display order for pickers and legends (not the enum's declaration
 * order, which groups `missing` right after `healthy` — reads better with `missing` last, next to
 * the equally-exceptional `planned_extraction`). */
export const CONDITION_ORDER: DentalConditionType[] = [
  "healthy",
  "caries",
  "lesion",
  "composite",
  "amalgam",
  "inlay",
  "onlay",
  "veneer",
  "crown",
  "bridge",
  "implant",
  "endodontics",
  "provisional",
  "planned_extraction",
  "missing",
];

/** FDI numbering: the last digit says what kind of tooth it is — 1/2 incisors, 3 canines (both
 * narrow, single-rooted "anterior" teeth), 4-8 premolars/molars ("posterior", wider, some with a
 * twin root). Used to pick which `ToothIcon` silhouette to draw. */
export function toothVariant(toothNumber: number): "anterior" | "posterior" {
  const lastDigit = toothNumber % 10;
  return lastDigit <= 3 ? "anterior" : "posterior";
}

export const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
export const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
export const ALL_TEETH = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT, ...LOWER_LEFT];
