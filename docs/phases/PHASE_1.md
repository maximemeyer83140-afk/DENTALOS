# PHASE 1 — Core

## Objectifs

Authentification fonctionnelle, RBAC appliqué au runtime (jamais côté client seul), et la preuve
que l'isolation tenant tient. Rien d'autre — pas d'écrans métier (patients, agenda, ...), qui
arrivent en Phase 2+.

## Décision D1 — Authentification (tranchée dans cette phase)

**Auth.js (next-auth) v5**, provider `Credentials` (email + mot de passe, +TOTP si MFA activé),
adaptateur Prisma, sessions **base de données** (pas JWT) — choisi pour pouvoir révoquer une
session immédiatement (employé qui part, compte compromis), ce qu'un JWT stateless ne permet pas
sans liste de révocation séparée. Schéma Prisma aligné sur la convention Auth.js standard
(`Account`/`Session`/`VerificationToken`, `User.name`/`image`/`emailVerified`) pour rester
compatible avec un ajout ultérieur de SSO (Google Workspace, Microsoft Entra) sans migration de
schéma.

MFA : TOTP (`otplib`), secret stocké dans `User.mfaSecret`. **Dette de sécurité documentée** :
Phase 1 stocke ce secret en clair — avant toute donnée réelle, il doit être chiffré au repos (voir
`SECURITY.md`).

## Changements base de données

- `User` : `fullName` → `name` (convention Auth.js), ajout `image`, `emailVerified`, `mfaSecret`.
- Nouveaux modèles : `Account`, `Session`, `VerificationToken` (schéma standard Auth.js/Prisma
  adapter).

## API / logique serveur

- `apps/web/src/lib/auth.ts` — config Auth.js, `authorize()` vérifie mot de passe (bcrypt), statut
  du compte, TOTP si activé, met à jour `lastLoginAt`.
- `apps/web/src/lib/rbac.ts` — `requirePermission(clinicId, permissionKey)` : lit la session
  serveur, vérifie que l'utilisateur a un accès à **cette** clinique (`UserClinicAccess`) et que le
  rôle associé porte la permission demandée. Retourne un `TenantContext` (`organizationId`,
  `clinicId`, `userId`, `roleId`) **dérivé de la session, jamais d'un paramètre client**. C'est le
  seul point d'entrée que le code métier doit utiliser pour obtenir un contexte tenant.
- `packages/database/src/repositories/practitioners.ts` — premier exemple du pattern de repository
  : toute requête est explicitement filtrée par `organizationId`/`clinicId` passés en paramètre
  (`TenantContext`), jamais une requête Prisma "nue" dans le code applicatif.

## UI

- `/login` — formulaire minimal (email, mot de passe, code TOTP optionnel). Pas de design system
  complet ici : le premium UI vient avec les écrans métier (Phase 2+).
- `middleware.ts` — toute route hors `/login` exige une session valide, sinon redirection.

## Permissions

Aucune nouvelle permission (la liste vit déjà dans `packages/database/src/permissions.ts` depuis la
Phase 0). Cette phase câble leur **vérification**, qui n'existait pas encore.

## Sécurité

- Mots de passe : `bcrypt` (jamais stockés en clair).
- Sessions révocables (stratégie base de données).
- Verrouillage/rate limiting : **non fait dans cette phase** — dette explicite, à traiter avant
  toute donnée réelle (voir `SECURITY.md`).
- `requirePermission` est le seul chemin autorisé pour accéder à des données scopées tenant depuis
  une route/server action.

## Tests

- `packages/database/src/repositories/practitioners.test.ts` — **test non négociable** (section 64
  du cahier des charges) : crée deux organisations distinctes avec des praticiens, et prouve que
  `listPractitioners` scopé à l'organisation A ne renvoie jamais un praticien de l'organisation B.
  Nécessite une vraie base Postgres (celle du CI, ou `dentalos_dev` en local).

## Definition of Done

- [x] Décision D1 tranchée et documentée
- [x] Schéma Prisma étendu (Account/Session/VerificationToken, champs User)
- [x] `auth.ts`, `rbac.ts`, `middleware.ts`, page `/login` écrits
- [x] Repository pattern amorcé (`practitioners.ts`) + test d'isolation tenant écrit
- [x] Seed étendu avec un utilisateur Owner (mot de passe dev uniquement, jamais réel)
- [ ] `pnpm install && pnpm db:migrate && pnpm test` exécutés avec succès — **bloqué dans cette
      session** (même limitation réseau qu'en Phase 0, voir `docs/phases/PHASE_0.md`). Le test
      d'isolation tenant n'a donc **pas encore tourné réellement** : à faire en priorité absolue
      dès que l'accès npm est rétabli, avant de considérer cette phase fiable.
