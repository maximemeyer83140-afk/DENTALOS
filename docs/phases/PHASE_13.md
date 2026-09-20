# PHASE 13 — Laboratoire dentaire (ÉTAPE 17)

## Contexte

Suite du développement autonome (Phases 6-12). `Laboratory`/`LabCase` existaient au schéma depuis
la Phase 0 sans repository ni UI. Une part importante de l'activité dentaire (couronnes, bridges,
prothèses) part au laboratoire et en revient sur un délai de plusieurs jours à plusieurs
semaines — sans suivi, un cabinet découvre un retard le jour du rendez-vous du patient plutôt
qu'avant. C'est le même besoin que les worklists déjà construits pour les rappels (Phase 6) et les
tâches (Phase 7), appliqué au cycle de vie d'un travail de laboratoire.

## Changements base de données

Aucune migration de schéma. Deux nouvelles clés de permission dans
`packages/database/src/permissions.ts` : `laboratory.read`, `laboratory.write` (catégorie
`laboratory`).

## API / logique serveur

- `packages/database/src/repositories/laboratories.ts` (nouveau) :
  - `listLaboratories` / `createLaboratory` — `Laboratory` appartient à l'organisation, pas à une
    seule clinique (même principe que `Supplier` en Phase 9 : un même prothésiste travaille pour
    plusieurs cabinets d'un groupe).
  - `listLabCases(ctx, { statuses? })` — le worklist clinique ; par défaut tout sauf `completed`,
    trié par retour attendu croissant (sans échéance en dernier), même logique que le worklist des
    tâches (Phase 7).
  - `listLabCasesForPatient`, `createLabCase` — vérifie patient, praticien et laboratoire
    appartiennent bien au tenant avant de créer.
  - `updateLabCaseStatus(ctx, caseId, status)` — horodate automatiquement `sentAt`/`receivedAt` la
    première fois que le statut passe par `sent`/`received` : la date à laquelle le labo a
    effectivement reçu ou retourné le cas est exactement ce que ces deux champs représentent,
    jamais une saisie séparée du changement de statut qui la rend vraie.
- Deux Server Actions distinctes appellent le même repository selon l'origine de l'action (même
  pattern que les rappels en Phase 6) : `createLabCaseAction`/`updateLabCaseStatusFromPatientAction`
  (`apps/web/src/app/patients/[id]/actions.ts`, revalident `/patients/[id]`) et
  `updateLabCaseStatusFromDashboardAction`/`createLaboratoryAction`
  (`apps/web/src/app/laboratoire/actions.ts`, revalident `/laboratoire`).

## UI

- **Onglet "Clinique" de la fiche patient** : nouvelle section "Laboratoire" sous le statut des
  soins — formulaire d'envoi (`LabCaseForm.tsx` : type de travail avec suggestions courantes via
  `<datalist>`, dent, praticien, laboratoire, retour attendu, coût) et liste des cas avec
  changement de statut inline (`LabCaseRow.tsx`).
- **`/laboratoire`** : worklist clinique — filtre "En cours"/"Toutes", ligne en retard surlignée en
  rouge (retour attendu dépassé et pas encore `completed`), changement de statut en un clic
  (`LabCaseDashboardRow.tsx`), gestion des laboratoires (`CreateLaboratoryForm.tsx`). La création
  d'un cas reste toujours initiée depuis la fiche patient (comme les rappels/tâches/consentements) :
  `LabCase.patientId` n'étant jamais optionnel, ce dashboard n'a pas besoin d'un sélecteur de
  patient qu'aucune autre page de ce type ne construit non plus.
- **`AppNav`** : lien "Laboratoire" affiché si `laboratory.read`.

## Permissions

`laboratory.read` (worklist, consultation), `laboratory.write` (créer un laboratoire/un cas,
changer un statut) — ajoutées à `PERMISSIONS`, attribuées automatiquement au rôle qui reçoit déjà
toutes les permissions dans le seed de développement.

## Sécurité / isolation tenant

Garde constante du projet : `createLabCase` vérifie l'appartenance du patient, du praticien et du
laboratoire au tenant avant toute écriture ; `updateLabCaseStatus` utilise `updateMany` scopé
plutôt qu'un `update` par id brut.

## Tests

`laboratories.test.ts` — mêmes conventions (org + clinique + org "autre" en fixtures) : création
d'un laboratoire et d'un cas, refus si patient/praticien/laboratoire n'appartiennent pas au tenant,
horodatage automatique de `sentAt`/`receivedAt` au passage des statuts correspondants (et jamais
avant), worklist qui exclut les cas `completed` et trie par échéance, isolation tenant totale
(mise à jour, liste) sur le cas d'une autre organisation. Vérifiés uniquement via
`node --experimental-strip-types --check` (syntaxe) et le script de bracket-balance pour les
`.tsx`, faute d'accès npm dans cet environnement — limitation constante de la session.

## Limitations connues

- **Pas d'alerte proactive sur un retard** : comme pour le stock bas (Phase 9), le retard se voit
  visuellement sur `/laboratoire` (ligne rouge) mais rien ne notifie activement — un lien avec
  `Task`/`Communication` (Phase 7) resterait le prolongement naturel.
- **`trackingRef`** (référence de suivi transporteur, déjà au schéma) n'est pas encore exposé dans
  le formulaire de création — candidat simple pour une prochaine itération si un cabinet en a
  l'usage.
- **Pas de facturation automatique du coût labo** : `LabCase.cost` est enregistré mais n'alimente
  ni une charge (Phase 12) ni le prix facturé au patient — deux registres qui restent
  indépendants, comme documenté pour `PurchaseOrderItem.unitCost` vs `InventoryItem.costPrice` en
  Phase 10.

## Definition of Done

- [x] `laboratories.ts` repository (laboratoires, cas, horodatage automatique de statut),
      tenant-scopé, avec tests.
- [x] Section "Laboratoire" dans l'onglet Clinique de la fiche patient.
- [x] Worklist clinique `/laboratoire` avec filtre, action rapide, gestion des laboratoires.
- [x] `AppNav` étendu, lien conditionné à `laboratory.read`.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] `pnpm typecheck` / `pnpm test` réels — bloqués par l'absence d'accès npm dans cet
      environnement (limitation constante de la session).
