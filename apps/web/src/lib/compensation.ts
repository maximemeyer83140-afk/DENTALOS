export const COMPENSATION_MODEL_LABEL: Record<string, string> = {
  salary: "Salaire fixe",
  percentage_revenue: "% du chiffre d'affaires facturé",
  percentage_collected: "% de l'encaissé",
  percentage_production: "% des actes réalisés (production)",
  hybrid: "Fixe + % au-delà d'un seuil",
};

export const COMPENSATION_MODEL_OPTIONS = Object.entries(COMPENSATION_MODEL_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export const COMPENSATION_MODEL_DESCRIPTION: Record<string, string> = {
  salary: "Montant fixe versé chaque période, indépendant du chiffre d'affaires.",
  percentage_revenue: "Rétrocession = taux × (total facturé − avoirs émis) sur la période.",
  percentage_collected: "Rétrocession = taux × montant réellement encaissé sur la période.",
  percentage_production: "Rétrocession = taux × valeur des actes réalisés (qu'ils soient facturés ou non).",
  hybrid: "Rétrocession = montant fixe + taux × (facturé net − seuil), seulement si le facturé net dépasse le seuil.",
};

export const COMPENSATION_STATEMENT_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  validated: "Validé",
  paid: "Payé",
};

export const COMPENSATION_STATEMENT_STATUS_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  validated: "bg-blue-50 text-blue-700",
  paid: "bg-green-50 text-green-700",
};

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, "")}%`;
}
