export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  rent: "Loyer",
  salaries: "Salaires",
  laboratory: "Laboratoire",
  equipment: "Équipement",
  consumables: "Consommables",
  insurance: "Assurances",
  software: "Logiciels",
  marketing: "Marketing",
  telecom: "Télécom",
  utilities: "Charges (eau/élec.)",
  training: "Formation",
  maintenance: "Entretien",
  accounting: "Comptabilité",
  banking: "Frais bancaires",
  other: "Autre",
};

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABEL).map(([value, label]) => ({ value, label }));

export const RECURRENCE_INTERVAL_LABEL: Record<string, string> = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  yearly: "Annuelle",
};

export const RECURRENCE_INTERVAL_OPTIONS = Object.entries(RECURRENCE_INTERVAL_LABEL).map(([value, label]) => ({ value, label }));
