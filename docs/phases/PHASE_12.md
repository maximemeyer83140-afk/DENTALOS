# PHASE 12 — Finances : charges & charges récurrentes (ÉTAPE 16)

## Contexte

Dernier module de cette série de développement autonome (Phases 6-11). `Expense`/
`RecurringExpense` existaient au schéma depuis la Phase 0 — et les permissions
`expenses.read`/`expenses.write` aussi — sans jamais avoir de repository ni d'UI. Un cabinet
dentaire a des charges fixes récurrentes (loyer, assurances, logiciels, télécom) en plus des
charges ponctuelles (matériel, formation) ; les suivre est la moitié manquante de la vue financière
du cabinet — `/statistiques` (Phase 7) ne montrait que le revenu encaissé, jamais ce qui sort.

## Changements base de données

Aucune migration de schéma. Aucune nouvelle clé de permission — `expenses.read`/`expenses.write`
existaient déjà depuis la Phase 0.

## Décision de conception — pas de scheduler réel

Une `RecurringExpense` ne se déclenche jamais toute seule dans cet environnement (même limitation
de fond que l'absence de provider SMS/email documentée depuis la Phase 6 : pas d'exécution en
arrière-plan possible ici). `generateExpenseFromRecurring` est l'équivalent manuel : un bouton
"Générer maintenant" crée une vraie `Expense` tracée (reliée à son modèle via
`recurringExpenseId`) et avance honnêtement `nextRunAt` de l'intervalle du modèle — jamais une
simple case cochée sans laisser de trace comptable.

## API / logique serveur

- `packages/database/src/repositories/expenses.ts` (nouveau) :
  - `listExpenses(ctx, { from?, to?, category? })` — filtrage par période et catégorie.
  - `createExpense(ctx, input, createdBy)` — vérifie que le fournisseur (optionnel) appartient au
    tenant avant de l'attacher.
  - `listRecurringExpenses` / `createRecurringExpense` / `setRecurringExpenseActive`.
  - `generateExpenseFromRecurring(ctx, recurringExpenseId, createdBy)` — transaction qui crée
    l'`Expense` et avance `nextRunAt` (`+1 mois`/`+3 mois`/`+1 an` selon `intervalUnit`) ensemble.
- Server Actions : `apps/web/src/app/finances/actions.ts` — `createExpenseAction`,
  `createRecurringExpenseAction`, `generateExpenseFromRecurringAction`,
  `setRecurringExpenseActiveAction` (ces deux derniers, actions simples sans formulaire, même
  pattern que `setUserStatusAction`/`setDocumentArchivedAction`).

## UI

- **`/finances`** : total du mois en tête, section "Charges récurrentes" (création via
  `CreateRecurringExpenseForm.tsx`, chaque ligne avec bouton "Générer maintenant" et
  activer/désactiver — `RecurringExpenseRow.tsx`), puis tableau des charges ponctuelles
  (création via `CreateExpenseForm.tsx`).
- **`AppNav`** : lien "Finances" affiché si `expenses.read`.

## Permissions

Aucune nouvelle clé — `expenses.read` (consultation) et `expenses.write` (créer une charge/un
modèle récurrent, générer une occurrence, activer/désactiver) réutilisées telles quelles.

## Sécurité / isolation tenant

Garde constante du projet : toute lecture/écriture scopée par `organizationId` + `clinicId`,
`createExpense` vérifie l'appartenance du fournisseur optionnel avant de l'attacher,
`generateExpenseFromRecurring`/`setRecurringExpenseActive` vérifient que le modèle appartient au
tenant avant toute action.

## Tests

`expenses.test.ts` — mêmes conventions (org + clinique + org "autre" en fixtures) : création et
filtrage par période/catégorie, création d'un modèle récurrent, génération d'une occurrence réelle
avec vérification que `nextRunAt` avance bien de l'intervalle attendu, activation/désactivation,
isolation tenant totale (liste, génération) sur le modèle d'une autre organisation. Vérifiés
uniquement via `node --experimental-strip-types --check` (syntaxe) et le script de bracket-balance
pour les `.tsx`, faute d'accès npm dans cet environnement — limitation constante de la session.

## Limitations connues

- **Pas de génération automatique** : voir la décision de conception ci-dessus — un modèle inactif
  ou simplement oublié ne génère jamais rien tout seul.
- **`/statistiques` ne montre toujours pas les charges** : le tableau de bord (Phase 7) reste
  focalisé sur le revenu encaissé — croiser revenu et charges pour une vraie vue de rentabilité
  (marge nette mensuelle) est le prolongement naturel de cette phase, non fait ici pour rester sur
  un livrable cohérent.
- **Pas de pièce jointe réelle** : `Expense.attachmentDocumentId` existe au schéma (lien vers un
  reçu/une facture scannée via le module Documents, Phase 3) mais le formulaire de création ne le
  renseigne pas encore — l'upload existe déjà (onglet Documents de la fiche patient) mais rien ne
  relie aujourd'hui un document à une charge non liée à un patient.

## Definition of Done

- [x] `expenses.ts` repository (charges ponctuelles + récurrentes, génération manuelle
      d'occurrence), tenant-scopé, avec tests.
- [x] `/finances` : charges récurrentes (création, génération, activer/désactiver) + charges
      ponctuelles (liste, création).
- [x] `AppNav` étendu, lien conditionné à `expenses.read`.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] `pnpm typecheck` / `pnpm test` réels — bloqués par l'absence d'accès npm dans cet
      environnement (limitation constante de la session).
