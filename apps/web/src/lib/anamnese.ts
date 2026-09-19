/**
 * The fixed 13-item "Pathologies / antécédents" list from ÉTAPE 4 of the brief — shared between
 * the validation schema (which builds one `path_<code>`/`path_<code>_notes` field pair per entry)
 * and the form UI (which renders one row per entry), so the two can never drift apart.
 */
export const PATHOLOGY_DEFS = [
  { code: "cardiovascular", label: "Maladies cardiovasculaires" },
  { code: "hypertension", label: "Hypertension" },
  { code: "diabetes", label: "Diabète" },
  { code: "coagulation", label: "Troubles de la coagulation" },
  { code: "respiratory", label: "Maladies respiratoires" },
  { code: "renal", label: "Maladies rénales" },
  { code: "hepatic", label: "Maladies hépatiques" },
  { code: "epilepsy", label: "Épilepsie" },
  { code: "immunosuppression", label: "Immunodépression" },
  { code: "infectious", label: "Maladies infectieuses pertinentes" },
  { code: "cancer", label: "Cancer / traitements oncologiques" },
  { code: "allergies", label: "Allergies" },
  { code: "other", label: "Autres pathologies" },
] as const;

export type PathologyCode = (typeof PATHOLOGY_DEFS)[number]["code"];

/** Medication-name keywords worth visually flagging in the medications list (ÉTAPE 4: "mettre
 * particulièrement en évidence certaines catégories importantes ... sans prendre automatiquement de
 * décision clinique à la place du praticien") — a display hint only, never an automatic alert or a
 * clinical judgment; the practitioner still reads and decides. */
export const DENTAL_RELEVANT_MEDICATION_KEYWORDS = [
  "anticoagul",
  "antiagrég",
  "antiplaquett",
  "cortison",
  "corticoïd",
  "corticoster",
  "bisphosphonate",
  "immunosuppresseur",
  "chimiothéra",
];

export function isDentalRelevantMedication(name: string): boolean {
  const normalized = name.toLowerCase();
  return DENTAL_RELEVANT_MEDICATION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
