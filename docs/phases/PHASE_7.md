# PHASE 7 — Consentements, Tâches internes & Tableau de bord (ÉTAPE 11)

## Contexte

Suite directe de la Phase 6 (rappels/communications), toujours en développement autonome à partir
de la demande "continue développe à fond, fonctionnel et intuitif, et complet". Trois modules
indépendants livrés ensemble parce que chacun était déjà prévu au schéma (Phase 0) sans jamais
avoir été branché, et que chacun répond à un besoin concret déjà identifié dans la recherche
concurrentielle (Phase 6) :

- **Consentements** — traçabilité légale (LPD/RGPD suisse), naturellement lié à `Document`.
- **Tâches internes** — checklist partagée du cabinet (DentaGest : "traçabilité complète des
  opérations"), pour ne plus dépendre d'un post-it ou de la mémoire d'une seule personne.
- **Tableau de bord / Statistiques** — les "statistiques exportables" mises en avant par DentaGest,
  ici sous forme de KPI calculés en temps réel plutôt qu'un export différé.

## Changements base de données

Aucune migration de schéma. `Consent` (avec `ConsentStatus`) et `Task` (avec `TaskPriority` /
`TaskStatus`) existent depuis la Phase 0 et sont utilisés tels quels. Nouvelles clés de permission
dans `packages/database/src/permissions.ts` : `consents.read`, `consents.write`, `tasks.read`,
`tasks.write`. Le tableau de bord réutilise `analytics.read`, déjà présent depuis la Phase 0 mais
jamais utilisé jusqu'ici.

## API / logique serveur

### Consentements
- `packages/database/src/repositories/consents.ts` :
  - `createConsent(ctx, { patientId, templateKey })` — crée une ligne `pending` ; si le même
    `templateKey` a déjà été demandé pour ce patient, `version` est incrémenté plutôt que
    d'écraser l'ancien enregistrement (un consentement décidé est un fait juridique, jamais réécrit).
  - `recordConsentDecision(ctx, consentId, { status: "signed" | "declined", signedByName?, documentId? })`
    — `updateMany` filtré sur `status: "pending"` : deux décisions concurrentes sur le même
    consentement ne peuvent jamais toutes les deux réussir, et un consentement déjà décidé lève une
    erreur explicite plutôt que d'être silencieusement réécrit.
  - `listConsentsForPatient(ctx, patientId)`.
- Catalogue de `templateKey` pré-remplis (texte libre en base, jamais un enum) dans
  `apps/web/src/lib/consents.ts` : consentement général, extraction, implant, anesthésie,
  orthodontie, information LPD, autre.

### Tâches
- `packages/database/src/repositories/users.ts` — `listUsersForClinic(ctx)` : tout utilisateur
  ayant un `UserClinicAccess` sur la clinique courante, triés par nom — c'est la même table que
  `requirePermission` vérifie déjà, donc la liste d'assignation ne peut jamais proposer quelqu'un
  qui a perdu l'accès à la clinique.
- `packages/database/src/repositories/tasks.ts` :
  - `createTask(ctx, input, createdBy)` — vérifie patient et assigné (accès clinique réel) avant
    création.
  - `listTasks(ctx, { statuses?, assignedToUserId?, patientId? })` — le tableau de bord clinique ;
    par défaut ne montre que `open`/`in_progress`, trié par échéance croissante (sans échéance en
    dernier).
  - `listTasksForPatient`, `updateTaskStatus` (même garde `updateMany` scopé tenant que partout
    ailleurs).

### Tableau de bord
- `packages/database/src/services/analytics.ts` — `getClinicDashboard(ctx)` : un seul appel qui
  agrège en parallèle (`Promise.all`) huit sources différentes — encaissé ce mois/depuis janvier
  (`Payment`, jamais le facturé), soins réalisés ce mois (`Treatment`, statut `completed`
  uniquement), devis des 90 derniers jours (`Quote.groupBy` par statut, taux d'acceptation),
  factures impayées (`Invoice` dans `issued`/`partially_paid`/`overdue`), rappels en retard
  (`Recall`), tâches ouvertes (`Task`), RDV du jour/de la semaine (`Appointment`), nouveaux
  patients du mois (`Patient`). Chaque chiffre est explicable : "encaissé" ≠ "facturé", le taux
  d'acceptation ne compte que les devis *décidés* sur une fenêtre récente pour ne jamais se diluer
  dans l'historique, et ne divise jamais par zéro (`acceptanceRate: null` si aucun devis décidé).

## UI

- **Onglet "Documents" de la fiche patient** : nouvelle section "Consentements" en tête d'onglet
  (`ConsentForm.tsx` pour la demande, `ConsentRow.tsx` pour enregistrer signé/refusé — deux boutons
  de soumission distincts dans un même formulaire, `name="status" value="signed"/"declined"`).
- **Onglet "Suivi" de la fiche patient** : nouvelle section "Tâches" en tête d'onglet
  (`PatientTaskForm.tsx` / `PatientTaskRow.tsx`), au-dessus des rappels et communications déjà
  présents.
- **`/taches`** : tableau de bord clinique des tâches — création avec assignation/priorité/échéance,
  filtre "Ouvertes"/"Toutes", changement de statut en un clic, ligne en retard surlignée.
- **`/statistiques`** : quatre groupes de tuiles (Finances, Activité clinique, Devis, Suivi), chaque
  tuile pertinente est cliquable vers la page qui la détaille (`/agenda`, `/rappels`, `/taches`,
  `/patients`), avec une mise en évidence visuelle (ambre/rouge) sur les factures impayées et les
  rappels en retard.
- **`AppNav`** étendu avec "Tâches" et "Statistiques".

## Permissions

`consents.read`, `consents.write`, `tasks.read`, `tasks.write` ajoutées à `PERMISSIONS` (attribuées
automatiquement au rôle qui reçoit déjà toutes les permissions dans le seed de développement).
`/statistiques` réutilise `analytics.read`.

## Sécurité / isolation tenant

Même garde constante : toute lecture/écriture passe par `organizationId` + `clinicId` du
`TenantContext`, `createConsent`/`createTask` vérifient l'appartenance du patient (et, pour les
tâches, de l'assigné via `UserClinicAccess`) avant toute écriture, `recordConsentDecision` et
`updateTaskStatus` utilisent `updateMany` scopé plutôt qu'un `update` par id brut.
`getClinicDashboard` scope chacune de ses huit requêtes par `organizationId` + `clinicId` —
aucune agrégation cross-tenant n'est possible.

## Tests

`consents.test.ts`, `users.test.ts`, `tasks.test.ts`, `analytics.test.ts` — mêmes conventions que
les phases précédentes (org + clinique + org "autre" en fixtures, isolation tenant systématiquement
vérifiée). `analytics.test.ts` construit un jeu de données connu (paiements complétés/échoués,
soins réalisés/planifiés, devis dans chaque statut, factures payées/impayées/annulées, rappel en
retard, tâche ouverte, RDV du jour) et vérifie chaque chiffre du tableau de bord contre sa valeur
attendue, plus un cas "clinique vide" pour le taux d'acceptation (`null`, jamais une division par
zéro). Vérifiés uniquement via `node --experimental-strip-types --check` (syntaxe) et le script de
bracket-balance pour les `.tsx`, faute d'accès npm dans cet environnement — limitation constante
déjà documentée dans toutes les phases précédentes.

## Limitations connues

- **Pas de génération PDF du consentement signé** : `Consent.documentId` permet de lier le
  consentement au PDF scanné une fois uploadé via l'onglet Documents, mais rien ne génère
  automatiquement ce PDF depuis un `templateKey` — l'utilisateur doit uploader le document signé
  séparément puis (amélioration future) le relier au consentement.
  `CommunicationTemplate` a la même limite documentée en Phase 6.
- **Pas de sous-tâches ni de commentaires** : `Task` reste un modèle plat (titre, description,
  priorité, échéance, un seul assigné) — suffisant pour une checklist de cabinet, pas pour un vrai
  outil de gestion de projet.
- **`/statistiques` n'est pas exportable** : contrairement à DentaGest, aucun export CSV/PDF des
  KPI n'existe encore — candidat naturel pour une prochaine itération.
- **Pas de switcher de clinique** : mêmes limitations que documentées en Phase 2/6
  (`getDefaultClinicId`).

## Definition of Done

- [x] `consents.ts` / `users.ts` / `tasks.ts` repositories + `analytics.ts` service, tenant-scopés,
      avec tests.
- [x] Clés de permission ajoutées (`consents.read/write`, `tasks.read/write`).
- [x] Section Consentements dans l'onglet Documents de la fiche patient.
- [x] Section Tâches dans l'onglet Suivi de la fiche patient.
- [x] Tableau de bord clinique `/taches` avec création, assignation, filtre, action rapide.
- [x] Tableau de bord `/statistiques` avec KPI réels sur quatre domaines.
- [x] `AppNav` étendu.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] `pnpm typecheck` / `pnpm test` réels — bloqués par l'absence d'accès npm dans cet
      environnement (limitation constante de la session).
