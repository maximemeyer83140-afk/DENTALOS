/** Mirrors the Prisma `DocumentCategory` enum — kept here once so the upload form's `<select>`
 * and the documents list's labels can never drift apart. */
export const DOCUMENT_CATEGORY_LABEL: Record<string, string> = {
  radiograph: "Radiographie",
  photograph: "Photographie",
  consent: "Consentement",
  quote: "Devis",
  invoice: "Facture",
  prescription: "Ordonnance",
  letter: "Courrier",
  insurance: "Document assurance",
  laboratory: "Compte rendu labo",
  other: "Autre",
};

export const DOCUMENT_CATEGORY_OPTIONS = Object.entries(DOCUMENT_CATEGORY_LABEL).map(([value, label]) => ({
  value,
  label,
}));
