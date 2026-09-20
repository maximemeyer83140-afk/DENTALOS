/**
 * Seed source-of-truth for RBAC permission keys (section 35 of the product brief). Grouped by
 * domain category; extend this list as new modules ship instead of inventing ad-hoc keys inline.
 */
export interface PermissionDefinition {
  key: string;
  category: string;
  description: string;
}

export const PERMISSIONS: PermissionDefinition[] = [
  { key: "patients.read", category: "patients", description: "Consulter les patients" },
  { key: "patients.write", category: "patients", description: "Créer / modifier les patients" },
  { key: "clinical.read", category: "clinical", description: "Consulter le dossier clinique" },
  { key: "clinical.write", category: "clinical", description: "Créer / modifier le dossier clinique" },
  { key: "invoices.read", category: "billing", description: "Consulter les factures" },
  { key: "invoices.create", category: "billing", description: "Créer des factures" },
  { key: "invoices.validate", category: "billing", description: "Valider des factures" },
  { key: "payments.create", category: "billing", description: "Enregistrer des paiements" },
  { key: "expenses.read", category: "finance", description: "Consulter les charges" },
  { key: "expenses.write", category: "finance", description: "Créer / modifier les charges" },
  { key: "analytics.read", category: "analytics", description: "Consulter les analytics" },
  { key: "settings.manage", category: "administration", description: "Gérer les paramètres du cabinet" },
  { key: "users.manage", category: "administration", description: "Gérer les utilisateurs et permissions" },
  { key: "inventory.read", category: "inventory", description: "Consulter le stock" },
  { key: "inventory.write", category: "inventory", description: "Gérer le stock et commandes" },
  { key: "agenda.read", category: "agenda", description: "Consulter l'agenda" },
  { key: "agenda.write", category: "agenda", description: "Créer / modifier des rendez-vous" },
  { key: "audit.read", category: "administration", description: "Consulter les journaux d'audit" },
  { key: "recalls.read", category: "suivi", description: "Consulter les rappels de contrôle" },
  { key: "recalls.write", category: "suivi", description: "Créer / modifier les rappels de contrôle" },
  { key: "communications.write", category: "suivi", description: "Enregistrer des communications patient (SMS, email, appel, courrier)" },
  { key: "consents.read", category: "suivi", description: "Consulter les consentements patient" },
  { key: "consents.write", category: "suivi", description: "Créer / modifier les consentements patient" },
  { key: "tasks.read", category: "administration", description: "Consulter les tâches internes du cabinet" },
  { key: "tasks.write", category: "administration", description: "Créer / modifier / assigner les tâches internes" },
  { key: "laboratory.read", category: "laboratory", description: "Consulter les travaux de laboratoire" },
  { key: "laboratory.write", category: "laboratory", description: "Créer / modifier les travaux de laboratoire" },
];

export function assertUniquePermissionKeys(permissions: PermissionDefinition[]): void {
  const seen = new Set<string>();
  for (const permission of permissions) {
    if (seen.has(permission.key)) {
      throw new Error(`Duplicate permission key: ${permission.key}`);
    }
    seen.add(permission.key);
  }
}
