export const PERMISSION_CATEGORY_LABEL: Record<string, string> = {
  patients: "Patients",
  clinical: "Clinique",
  billing: "Facturation",
  finance: "Finances",
  analytics: "Analytics",
  administration: "Administration",
  inventory: "Stock",
  agenda: "Agenda",
  suivi: "Suivi patient",
};

export const USER_STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  invited: "Invité",
  suspended: "Suspendu",
  disabled: "Désactivé",
};

export const USER_STATUS_CLASS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  invited: "bg-blue-50 text-blue-700",
  suspended: "bg-amber-50 text-amber-700",
  disabled: "bg-muted text-muted-foreground",
};

/** Generates a temporary password an admin can hand to a new teammate — random enough to not be
 * guessable, short enough to type from a sticky note during onboarding. The teammate is expected
 * to change it themselves afterwards (no forced-change-on-first-login flow yet, see PHASE_8.md). */
export function generateTemporaryPassword(): string {
  const words = ["dent", "sourire", "cabinet", "geneve", "zurich", "lausanne", "bale", "berne"];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${word!.charAt(0).toUpperCase()}${word!.slice(1)}${digits}!`;
}
