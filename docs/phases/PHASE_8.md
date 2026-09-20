# PHASE 8 — Équipe & gestion des rôles (ÉTAPE 12)

## Contexte

Suite du développement autonome (Phases 6-7). Jusqu'ici le RBAC de DentalOS (rôles, permissions,
accès par clinique) était entièrement fonctionnel côté serveur — `requirePermission`,
`UserClinicAccess`, le modèle `Role`/`Permission`/`RolePermission` — mais totalement invisible et
non modifiable depuis l'UI : le seul moyen de créer un utilisateur ou d'ajuster des permissions
était d'éditer `seed.ts` et de relancer le seed. Un cabinet réel a plusieurs collaborateurs à des
postes différents (assistante, hygiéniste, réceptionniste) qui ont besoin d'accès différents dès
le premier jour d'utilisation — sans cet écran, DentalOS n'est utilisable que par un seul
utilisateur. C'est aussi directement le thème DentaGest identifié en Phase 6 : "droits d'accès
fins avec traçabilité".

## Changements base de données

Aucune migration de schéma : `Role`, `Permission`, `RolePermission`, `UserClinicAccess` existent
depuis la Phase 0. Aucune nouvelle clé de permission — `users.manage` existait déjà et n'avait
jamais eu d'écran pour l'exercer.

## API / logique serveur

- `packages/database/src/repositories/roles.ts` (nouveau) :
  - `listRoles(ctx)` / `getRole(ctx, roleId)` — scopés par `organizationId` (pas `clinicId` : un
    rôle est partagé entre toutes les cliniques de l'organisation, c'est `UserClinicAccess` qui
    scope l'*attribution* d'un rôle à une clinique précise).
  - `createRole(ctx, name, permissionKeys)`.
  - `updateRolePermissions(ctx, roleId, permissionKeys)` — remplace tout le jeu de permissions en
    une transaction (`deleteMany` + `createMany`) : l'UI envoie toujours l'état complet de la
    matrice de cases à cocher, jamais une modification incrémentale.
- `packages/database/src/repositories/users.ts` (étendu) :
  - `listTeamMembers(ctx)` — variante détaillée de `listUsersForClinic` (Phase 7) avec statut, rôle
    et dernière connexion, pour l'écran d'équipe.
  - `createClinicUser(ctx, { email, name, roleId, temporaryPassword })` — vérifie que le rôle
    appartient à l'organisation, que l'email n'est pas déjà pris, hache le mot de passe (bcrypt,
    même façon que `seed.ts`), crée `User` + `UserClinicAccess` pour la clinique courante en une
    fois. Créé `active` immédiatement (voir Limitations).
  - `updateUserClinicRole(ctx, userId, roleId)` — change le rôle **pour cette clinique
    uniquement** (`UserClinicAccess.userId_clinicId`), jamais les autres accès clinique du même
    utilisateur.
  - `setUserStatus(ctx, userId, status)` — `User.status` est global (un seul compte, pas un statut
    par clinique), donc l'action est gatée sur "l'utilisateur cible a bien accès à *cette*
    clinique" plutôt que scopée par `clinicId` directement (`User` ne porte pas de `clinicId`).
- Server Actions : `apps/web/src/app/equipe/actions.ts` — `createUserAction`, `updateUserRoleAction`,
  `setUserStatusAction` (action simple, pas de formulaire — bascule active/suspended, même
  pattern que `setDocumentArchivedAction`), `createRoleAction`, `updateRolePermissionsAction`
  (ces deux derniers lisent `formData.getAll("permissionKeys")`, pas
  `Object.fromEntries`, pour capter toutes les cases cochées de la matrice).
- `PERMISSIONS` (le catalogue source de vérité de `packages/database/src/permissions.ts`) est
  maintenant exporté par `@dentalos/database` — l'UI construit sa matrice de cases à cocher
  directement dessus, jamais une liste dupliquée à la main.

## UI

- **`/equipe`** : deux sections.
  - *Collaborateurs* : `InviteUserForm.tsx` (nom, email, rôle, mot de passe provisoire généré
    automatiquement et modifiable, bouton ↻ pour en régénérer un) puis un tableau
    (`TeamMemberRow.tsx`) avec changement de rôle en ligne, badge de statut, dernière connexion, et
    bouton suspendre/réactiver.
  - *Rôles & permissions* : une `RoleCard.tsx` par rôle existant (nombre de permissions et de
    membres, édition de la matrice de permissions groupée par catégorie), et
    `CreateRoleForm.tsx` pour créer un nouveau rôle avec sa propre matrice de zéro.
  - `PermissionCheckboxes.tsx` — composant partagé entre édition et création : regroupe les
    permissions par catégorie (`PERMISSION_CATEGORY_LABEL` dans `lib/team.ts`), chaque case coche
    `name="permissionKeys"` pour que le formulaire les collecte en un array sans état React.
- **`AppNav`** : le lien "Équipe" n'apparaît que pour un utilisateur dont la permission
  `users.manage` figure dans sa première clinique — jamais affiché à quelqu'un à qui
  `requirePermission` refuserait de toute façon la page.

## Permissions

Aucune nouvelle clé — tout l'écran est gated sur `users.manage`, déjà présente depuis la Phase 0.

## Sécurité / isolation tenant

Garde constante du projet : `createClinicUser` vérifie que le `roleId` fourni appartient à
`ctx.organizationId` avant de l'attribuer (jamais un rôle d'une autre organisation) ;
`updateUserClinicRole` et `setUserStatus` vérifient que l'utilisateur cible a un
`UserClinicAccess` réel sur `ctx.clinicId` avant toute modification — un administrateur d'une
clinique A ne peut jamais toucher un utilisateur qui n'a accès qu'à une clinique B, même dans la
même organisation. Le mot de passe est haché avec bcrypt (12 rounds, identique à `seed.ts`) avant
stockage — jamais en clair, jamais même transitoirement journalisé côté serveur.

## Tests

`roles.test.ts` (nouveau) et l'extension de `users.test.ts` avec un second `describe` "team
management" — mêmes conventions que toutes les phases précédentes : org + clinique + org "autre"
en fixtures, isolation tenant vérifiée sur chaque opération d'écriture (création avec un rôle
étranger refusée, changement de rôle/statut d'un utilisateur sans accès à la clinique refusé),
plus le remplacement complet (jamais fusionné) d'un jeu de permissions et le hash effectif du mot
de passe stocké (`passwordHash !== temporaryPassword`). Vérifiés uniquement via
`node --experimental-strip-types --check` (syntaxe) et le script de bracket-balance pour les
`.tsx`, faute d'accès npm dans cet environnement — limitation constante déjà documentée dans
toutes les phases précédentes.

## Limitations connues

- **Pas d'email d'invitation** : `createClinicUser` crée le compte `active` immédiatement avec le
  mot de passe provisoire choisi par l'admin — celui-ci doit le communiquer lui-même au
  collaborateur (affiché à l'écran après création). Aucun envoi d'email, aucun flux
  d'acceptation d'invitation séparé, aucune contrainte de changement de mot de passe à la première
  connexion. Même limitation de fond que les Phases 6-7 (pas de provider SMS/email réel).
- **Pas de suppression de rôle ni d'utilisateur** : seulement suspendre/réactiver un utilisateur et
  éditer les permissions d'un rôle — jamais de suppression définitive (cohérent avec le principe
  "jamais de suppression silencieuse" déjà appliqué aux consentements/factures).
- **Aucune protection contre l'auto-verrouillage** : rien n'empêche un administrateur de retirer
  `users.manage` de son propre rôle et de se couper l'accès à cet écran — à corriger dans une
  itération future (ex. interdire de retirer sa propre dernière permission `users.manage`).
- **Pas de switcher de clinique** : `/equipe` gère l'équipe de la première clinique de
  l'utilisateur (`getDefaultClinicId`), même limitation que documentée depuis la Phase 2.

## Definition of Done

- [x] `roles.ts` repository + extension de `users.ts`, tenant-scopés, avec tests.
- [x] `PERMISSIONS` exporté par `@dentalos/database` pour piloter la matrice UI.
- [x] `/equipe` : liste des collaborateurs, invitation, changement de rôle, suspendre/réactiver.
- [x] Gestion des rôles : édition des permissions d'un rôle existant, création d'un nouveau rôle.
- [x] `AppNav` étendu, lien conditionné à `users.manage`.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] `pnpm typecheck` / `pnpm test` réels — bloqués par l'absence d'accès npm dans cet
      environnement (limitation constante de la session).
