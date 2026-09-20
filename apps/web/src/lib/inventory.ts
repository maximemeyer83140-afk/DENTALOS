export const INVENTORY_CATEGORY_LABEL: Record<string, string> = {
  composites: "Composites",
  adhesives: "Adhésifs",
  anesthetics: "Anesthésiques",
  needles: "Aiguilles",
  gloves: "Gants",
  masks: "Masques",
  burs: "Fraises",
  implants: "Implants",
  sutures: "Sutures",
  disinfection: "Désinfection",
  consumables: "Consommables divers",
  laboratory: "Laboratoire",
  other: "Autre",
};

export const INVENTORY_CATEGORY_OPTIONS = Object.entries(INVENTORY_CATEGORY_LABEL).map(([value, label]) => ({ value, label }));

export const INVENTORY_MOVEMENT_TYPE_LABEL: Record<string, string> = {
  receipt: "Réception",
  consumption: "Consommation",
  adjustment: "Ajustement",
  transfer: "Transfert",
};

export const INVENTORY_MOVEMENT_TYPE_CLASS: Record<string, string> = {
  receipt: "bg-green-50 text-green-700",
  consumption: "bg-blue-50 text-blue-700",
  adjustment: "bg-amber-50 text-amber-700",
  transfer: "bg-muted text-muted-foreground",
};
