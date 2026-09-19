# PHASE 6 — Rappels de contrôle & Communications (Suivi patient)

## Contexte

Cette phase n'est plus pilotée par le plan en 9 étapes "Agenda + Fiche patient" (terminé) mais par
une demande ouverte : continuer le développement de toute section ou fonctionnalité jugée
pertinente pour faire de DentalOS une plateforme dont les praticiens "ne peuvent plus se passer",
en s'appuyant sur ce que proposent les concurrents suisses **ZaWin** et **DentaGest**.

Recherche concurrentielle (résumé) :
- **ZaWin** (leader suisse, 1500+ installations) : architecture modulaire, workflow sans papier,
  module de rappel patient (recall), interface radiographie VDDS/SLIDA.
- **DentaGest** (éditeur suisse depuis 1990) : gestion comptable complète (devis, encaissements,
  travaux en cours, suivi débiteurs), rapprochement bancaire automatique via fichiers camt.054,
  statistiques exportables, droits d'accès fins avec traçabilité complète, "aide-mémoires"
  intégrés pour la saisie rapide, trilingue FR/DE/IT.

Le schéma Prisma prévoyait déjà depuis la Phase 0 les modèles `Recall`, `Communication`,
`CommunicationTemplate` et `Consent` — jamais branchés à un repository ni une UI. Le rappel de
contrôle est le mécanisme de fidélisation/revenu récurrent le plus cité chez les deux concurrents
étudiés : c'est la priorité choisie pour cette phase, avec le journal de communications qui
l'accompagne naturellement (savoir *qu'*un patient en retard a été relancé, par quel canal, quand).

`Consent` (consentements signés) et `CommunicationTemplate` (envoi automatisé de SMS/email) restent
hors scope de cette phase — voir Limitations connues.

## Objectifs

1. Un **worklist clinique** (`/rappels`) qui rend les rappels dus/en retard visibles et actionnables
   au quotidien, au lieu d'un enregistrement `Recall` qu'on ne consulte plus jamais après création.
2. Un **onglet "Suivi"** sur la fiche patient (9ᵉ onglet) : historique des rappels du patient +
   journal manuel de ses communications (appel, SMS, email, courrier, note interne).
3. Une **navigation partagée** entre Agenda / Patients / Rappels — jusqu'ici trois arborescences de
   routes sans aucun lien entre elles hormis un "← Retour à la liste" sur la fiche patient.

## Changements base de données

Aucune migration de schéma : `Recall` (avec `RecallStatus`) et `Communication` (avec
`CommunicationChannel`/`CommunicationDirection`) existent depuis la Phase 0 et sont utilisés tels
quels. Deux nouvelles clés de permission ajoutées à `packages/database/src/permissions.ts` :
`recalls.read`, `recalls.write`, `communications.write` (catégorie `suivi`).

## API / logique serveur

- `packages/database/src/repositories/recalls.ts` :
  - `listRecalls(ctx, { statuses?, dueBefore?, patientId? })` — le worklist clinique ; par défaut
    ne renvoie que les statuts ouverts (`to_contact`, `contacted`, `scheduled`), trié par échéance
    croissante, avec le patient inclus (nom, téléphone, email) pour être directement actionnable.
  - `listRecallsForPatient(ctx, patientId)` — historique complet d'un patient, plus récent d'abord.
  - `createRecall(ctx, input)` — vérifie que le patient appartient bien à l'organisation/clinique
    avant de créer (même garde que tous les autres repositories du projet).
  - `updateRecallStatus(ctx, recallId, status, notes?)` — `updateMany` scopé tenant + relance,
    jamais un `update` sur id brut (règle constante du projet).
- `packages/database/src/repositories/communications.ts` :
  - `logCommunication(ctx, input, createdBy)` — enregistrement manuel ; `direction` par défaut
    `outbound`, `sentAt` posé à la création.
  - `listCommunicationsForPatient(ctx, patientId)` — plus récent d'abord.
- Server Actions : `createRecallAction`, `updateRecallStatusFromPatientAction`,
  `logCommunicationAction` (`apps/web/src/app/patients/[id]/actions.ts`, revalident
  `/patients/[id]`) ; `updateRecallStatusFromDashboardAction`
  (`apps/web/src/app/rappels/actions.ts`, revalide `/rappels`) — deux Server Actions distinctes
  qui appellent le même repository, seule la page revalidée diffère selon l'origine de l'action.
- Validation : `apps/web/src/lib/validation/recalls.ts` (zod, même style que
  `validation/documents.ts`).

## UI

- **`/rappels`** (`apps/web/src/app/rappels/page.tsx`) : tableau trié par échéance, ligne en retard
  surlignée en rouge, filtre "En cours" (défaut) / "Tous", changement de statut en un clic depuis la
  ligne (`RecallDashboardRow.tsx`, client component).
- **Onglet "Suivi"** sur la fiche patient (`page.tsx`, entre "Documents" et "Rendez-vous") :
  formulaire de planification (`RecallForm.tsx`), liste des rappels avec édition de statut inline
  (`RecallRow.tsx`, même pattern que `DocumentRow.tsx`), formulaire de log de communication
  (`CommunicationForm.tsx`) et journal en lecture seule en dessous.
- **`AppNav`** (`apps/web/src/components/AppNav.tsx`) : nav server component minimal (Agenda /
  Patients / Rappels), rendu en tête de chaque page de premier niveau plutôt que dans le layout
  racine — pour ne jamais l'afficher sur `/login`. Vérifie la session et ne rend rien si absente.
- Labels/couleurs de statut centralisés dans `apps/web/src/lib/recalls.ts` (même principe que
  `lib/documents.ts`) pour que le dashboard et l'onglet patient ne divergent jamais.

## Permissions

`recalls.read` (worklist), `recalls.write` (créer/modifier un rappel, dans les deux Server
Actions de mise à jour de statut), `communications.write` (journaliser un contact). Ajoutées à
`PERMISSIONS` — le seed de développement les attribue automatiquement au rôle qui reçoit déjà
toutes les permissions existantes (`createMany` sur `allPermissions`).

## Sécurité / isolation tenant

Même garde partout : toute lecture/écriture passe par `organizationId` + `clinicId` du
`TenantContext` issu de `requirePermission`, `createRecall`/`logCommunication` vérifient d'abord
que le `patientId` fourni appartient bien à ce tenant avant toute écriture, `updateRecallStatus`
utilise `updateMany` scopé plutôt qu'un `update` par id brut.

## Tests

`packages/database/src/repositories/recalls.test.ts` et `communications.test.ts` — même structure
que les tests existants (org + clinique + org "autre" en `beforeAll`, `afterAll` nettoie) :
création, refus d'attacher un rappel/une communication à un patient d'une autre organisation, tri
du worklist par échéance en excluant les statuts fermés, cycle de statut, isolation tenant sur la
lecture et la mise à jour. Vérifiés uniquement via `node --experimental-strip-types --check`
(syntaxe) faute d'accès npm dans cet environnement — voir la limitation constante déjà documentée
dans les phases précédentes.

## Limitations connues

- **Pas d'envoi réel** : `logCommunication` enregistre qu'un contact a eu lieu, DentalOS n'envoie
  aucun SMS/email lui-même. `CommunicationTemplate` (modèle déjà en base) et un vrai provider
  SMS/email restent à construire — c'est ce qui manque pour automatiser la relance des rappels
  `to_contact` en retard plutôt que de compter sur un praticien qui consulte `/rappels` chaque jour.
- **Pas de génération automatique de rappel** : un rappel se crée uniquement à la main depuis
  l'onglet Suivi. Le générer automatiquement après un acte donné (ex. détartrage → rappel à 6 mois)
  serait la suite logique, alignée sur le comportement ZaWin, mais dépendrait de règles métier par
  type d'acte non encore spécifiées.
- **`Consent`** (consentements patients signés) reste un modèle inutilisé — hors scope de cette
  phase, candidat naturel pour la suivante étant donné son lien direct avec `Document`.
- **Pas de switcher de clinique** : `/rappels` hérite de la même limitation documentée en Phase 2
  (`getDefaultClinicId` — première clinique de l'utilisateur, pas de sélection).

## Definition of Done

- [x] Repositories `recalls.ts` / `communications.ts`, tenant-scopés, avec tests.
- [x] Clés de permission ajoutées (`recalls.read`, `recalls.write`, `communications.write`).
- [x] Worklist clinique `/rappels` avec filtre et action rapide de changement de statut.
- [x] Onglet "Suivi" sur la fiche patient (rappels + communications).
- [x] Navigation partagée entre Agenda / Patients / Rappels.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] `pnpm typecheck` / `pnpm test` réels — bloqués par l'absence d'accès npm dans cet
      environnement (limitation constante de la session, déjà documentée dans les phases
      précédentes).
