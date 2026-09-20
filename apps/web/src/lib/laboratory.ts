export const LAB_CASE_STATUS_LABEL: Record<string, string> = {
  to_send: "À envoyer",
  sent: "Envoyé",
  in_production: "En fabrication",
  received: "Reçu",
  fitted: "Essayé",
  completed: "Terminé",
};

export const LAB_CASE_STATUS_OPTIONS = Object.entries(LAB_CASE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

export const LAB_CASE_STATUS_CLASS: Record<string, string> = {
  to_send: "bg-amber-50 text-amber-700",
  sent: "bg-blue-50 text-blue-700",
  in_production: "bg-indigo-50 text-indigo-700",
  received: "bg-green-50 text-green-700",
  fitted: "bg-green-50 text-green-700",
  completed: "bg-muted text-muted-foreground",
};

/** Common dental lab work types — kept as free text in the schema (never an enum, a cabinet's
 * vocabulary varies), this list only pre-fills the create form's `<select>`. */
export const LAB_WORK_TYPE_PRESETS = [
  "Couronne céramique",
  "Couronne zircone",
  "Bridge",
  "Prothèse complète",
  "Prothèse partielle",
  "Gouttière occlusale",
  "Facette",
  "Inlay / Onlay",
  "Appareil orthodontique",
];
