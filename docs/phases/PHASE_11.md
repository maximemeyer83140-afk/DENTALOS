# PHASE 11 — Switcher de clinique (ÉTAPE 15)

## Contexte

Suite du développement autonome (Phases 6-10). Depuis `docs/phases/PHASE_2.md`, une même limitation
était réaffirmée dans chaque phase suivante : `getDefaultClinicId()` renvoie toujours la
*première* clinique à laquelle l'utilisateur a accès, sans aucun moyen d'en choisir une autre.
Bénin pour un cabinet mono-site, bloquant pour tout groupe multi-cliniques (le modèle
`UserClinicAccess` prévoit explicitement qu'un utilisateur ait accès à plusieurs cliniques avec des
rôles différents dans chacune) — cette phase ferme cette limitation transversale plutôt que
d'ajouter un nouveau module métier.

## Décision de conception

Aucune nouvelle table : la clinique active est un choix de session, pas une donnée métier — stockée
dans un cookie (`dentalos-active-clinic`), jamais en base. `getDefaultClinicId()` (dans
`apps/web/src/lib/clinic-context.ts`) garde son nom d'origine (décision de la Phase 2) plutôt que
d'être renommé : un renommage aurait touché toutes les pages et Server Actions de l'application
(des dizaines de fichiers) pour aucun gain fonctionnel, et le nom reste juste — "la clinique par
défaut" est exactement ce que `clinics[0]` a toujours été, maintenant surchargeable par cookie.

Le cookie n'est **jamais fait confiance aveuglément** : `getDefaultClinicId` ne le retient que s'il
nomme une clinique à laquelle la session a *actuellement* accès (comparé à
`session.user.clinics`) — un cookie périmé ou manipulé ne peut jamais donner accès à une clinique
que l'utilisateur n'a plus, exactement le même principe que `requirePermission` applique aux
permissions.

## Changements base de données

Aucun — c'est tout l'intérêt de cette phase.

## API / logique serveur

- `apps/web/src/lib/clinic-context.ts` — `getDefaultClinicId()` lit maintenant le cookie
  `ACTIVE_CLINIC_COOKIE` (exporté pour que `setActiveClinicAction` partage la même constante),
  retombe sur `clinics[0]` si absent ou si la clinique nommée n'est plus accessible.
- `apps/web/src/app/clinic-actions.ts` (nouveau) — `setActiveClinicAction(clinicId)` : vérifie que
  `clinicId` figure bien dans `session.user.clinics` avant d'écrire le cookie (`httpOnly`,
  `sameSite: lax`, 1 an) — la même garde que `requirePermission` applique à toute permission.

## UI

- `apps/web/src/components/ClinicSwitcher.tsx` (nouveau, client) — un `<select>` qui n'apparaît que
  si l'utilisateur a accès à plus d'une clinique (`clinics.length <= 1` → ne rend rien) ; au
  changement, appelle `setActiveClinicAction` puis `router.refresh()` pour que tous les Server
  Components de la page en cours se re-rendent avec la nouvelle clinique.
- `AppNav` — rend `ClinicSwitcher` en bout de barre de navigation, et lit désormais les permissions
  de la clinique *active* (`session.user.clinics.find(c => c.clinicId === activeClinicId)`) plutôt
  que toujours `clinics[0]` — un lien comme "Équipe" ou "Stock" apparaît/disparaît correctement
  quand on change de clinique si les permissions du rôle diffèrent d'une clinique à l'autre.

## Permissions

Aucune nouvelle clé — la sélection de clinique active n'est pas elle-même une permission, c'est un
préalable à en vérifier une (`requirePermission(clinicId, ...)` s'exécute toujours après que
`clinicId` a été résolu).

## Sécurité

`setActiveClinicAction` revalide l'accès à chaque appel (jamais un id de clinique accepté tel
quel), et `getDefaultClinicId` revalide à chaque requête que la clinique du cookie est toujours
accessible — un utilisateur dont l'accès à une clinique est révoqué (Phase 8 : suspendre/changer de
rôle) ne peut jamais continuer à agir dessus simplement parce que son cookie la nomme encore.

## Tests

Module transversal sans nouvelle logique métier testable isolément (pas de repository) — la garde
"le cookie ne gagne que s'il est dans `session.user.clinics`" est la même relation de confiance que
`requirePermission` applique déjà et que les tests RBAC existants (Phase 1) couvrent au niveau
`UserClinicAccess`. Vérifié via `node --experimental-strip-types --check` (syntaxe) et le script de
bracket-balance pour les `.tsx`, faute d'accès npm dans cet environnement — limitation constante de
la session.

## Limitations connues

- **Un seul praticien de seed, une seule clinique** : le seed de développement
  (`packages/database/src/seed.ts`) ne crée qu'une clinique — le switcher est fonctionnel mais
  invisible tant qu'un second `UserClinicAccess` n'existe pas pour un utilisateur donné. Une
  démonstration réelle demanderait d'étendre le seed avec une deuxième clinique.
- **Pas de mémorisation par appareil vs par compte** : le choix est un cookie de navigateur, donc
  par appareil — se connecter depuis un autre poste retombe sur `clinics[0]` jusqu'au premier
  changement, jamais synchronisé entre appareils (cohérent avec le principe "rien en base" retenu
  ci-dessus, mais à noter).

## Definition of Done

- [x] `getDefaultClinicId` respecte un cookie de clinique active, avec revalidation systématique
      de l'accès.
- [x] `setActiveClinicAction` — Server Action gardée, jamais un id de clinique accepté sans
      vérification.
- [x] `ClinicSwitcher` — n'apparaît que pour un utilisateur multi-cliniques, rafraîchit la page
      après changement.
- [x] `AppNav` lit les permissions de la clinique active, pas toujours la première.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] `pnpm typecheck` / `pnpm test` réels — bloqués par l'absence d'accès npm dans cet
      environnement (limitation constante de la session).
