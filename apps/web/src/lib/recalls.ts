/** Mirrors the Prisma `RecallStatus` enum — kept here once so the patient-fiche "Suivi" tab and
 * the clinic-wide /rappels worklist can never show a different label for the same status. */
export const RECALL_STATUS_LABEL: Record<string, string> = {
  to_contact: "À contacter",
  contacted: "Contacté",
  scheduled: "RDV planifié",
  no_response: "Sans réponse",
  declined: "Refusé",
};

export const RECALL_STATUS_OPTIONS = Object.entries(RECALL_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export const RECALL_STATUS_CLASS: Record<string, string> = {
  to_contact: "bg-amber-50 text-amber-700",
  contacted: "bg-blue-50 text-blue-700",
  scheduled: "bg-green-50 text-green-700",
  no_response: "bg-red-50 text-red-700",
  declined: "bg-muted text-muted-foreground",
};

/** Mirrors the Prisma `CommunicationChannel` enum. */
export const COMMUNICATION_CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  call: "Appel",
  letter: "Courrier",
  note: "Note interne",
};

export const COMMUNICATION_CHANNEL_OPTIONS = Object.entries(COMMUNICATION_CHANNEL_LABEL).map(([value, label]) => ({
  value,
  label,
}));
