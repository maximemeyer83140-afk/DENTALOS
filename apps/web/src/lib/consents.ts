/** Catalogue des modèles de consentement les plus courants en cabinet dentaire suisse. `Consent`
 * garde `templateKey` en texte libre côté base (pas d'enum) pour ne jamais bloquer un cabinet qui a
 * son propre formulaire — cette liste n'est qu'un jeu de valeurs pré-remplies dans le `<select>`. */
export const CONSENT_TEMPLATE_LABEL: Record<string, string> = {
  consentement_general: "Consentement général aux soins",
  consentement_extraction: "Consentement — extraction",
  consentement_implant: "Consentement — pose d'implant",
  consentement_anesthesie: "Consentement — anesthésie",
  consentement_orthodontie: "Consentement — traitement orthodontique",
  rgpd_lpd: "Information LPD / traitement des données",
  autre: "Autre",
};

export const CONSENT_TEMPLATE_OPTIONS = Object.entries(CONSENT_TEMPLATE_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export const CONSENT_STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  signed: "Signé",
  declined: "Refusé",
  expired: "Expiré",
};

export const CONSENT_STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  signed: "bg-green-50 text-green-700",
  declined: "bg-red-50 text-red-700",
  expired: "bg-muted text-muted-foreground",
};
