# PHASE 0 — Architecture

## Objectifs

Poser des fondations capables de supporter plusieurs années de développement sans reconstruction :
documents de référence, structure de monorepo, modèle de données initial, outillage qualité.
Aucune fonctionnalité utilisateur n'est livrée dans cette phase.

## Périmètre exécuté

- `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `COMPLIANCE.md`, `ROADMAP.md` à la racine.
- Monorepo pnpm : `apps/web` (Next.js/React/TypeScript/Tailwind), `packages/database`
  (Prisma), `packages/config` (tsconfig/eslint partagés).
- Modèle de données initial complet (`packages/database/prisma/schema.prisma`) couvrant les
  entités de la section 53 du cahier des charges : tenancy, RBAC, patients, agenda, clinique,
  devis, moteur tarifaire suisse, facturation, stocks, finance, analytics/automatisation.
- Seed de développement minimal (organisation, clinique, permissions RBAC, rôle Owner, deux
  praticiens fictifs — `Cabinet Dentaire Léman`, section 77).
- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.), ESLint (flat
  config), Prettier, Vitest (un test par package), workflow CI GitHub Actions.

## Limitation rencontrée dans cet environnement d'exécution

L'environnement d'exécution de cette session a une politique réseau qui **refuse l'accès à
`registry.npmjs.org`** (réponse `403 host_not_allowed` de la passerelle de sortie réseau, testé
directement et via `npm`/`pnpm`). Conséquence concrète :

- `pnpm install` n'a pas pu être exécuté → aucune dépendance n'est installée dans ce commit.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` n'ont donc **pas pu être exécutés
  réellement** dans cette session — ils ne peuvent pas l'être tant que les dépendances ne sont pas
  installées.
- La première migration Prisma (`pnpm db:migrate`) n'a pas pu être générée pour la même raison
  (le CLI `prisma` n'est pas installable).

**Ce qui a été fait pour compenser** : relecture manuelle exhaustive de `schema.prisma` (cohérence
de toutes les relations Prisma, appariement des deux côtés de chaque `@relation`, vérification que
chaque type d'énumération référencé est bien défini — vérifié par un script de recoupement
automatisé sur les noms de types) et du reste du code TypeScript écrit. Une instance PostgreSQL 16
locale a été démarrée et une base `dentalos_dev` créée, prête pour la première migration dès que
l'installation des dépendances sera possible.

**Action requise avant de considérer cette phase "vérifiée"** : dans un environnement ayant accès
à `registry.npmjs.org` (ou après ajustement de la politique réseau de cet environnement dans les
paramètres Claude Code on the web), exécuter :

```bash
pnpm install
pnpm db:generate
pnpm db:migrate      # génère la première migration SQL versionnée
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

et corriger toute erreur réelle qui en ressortirait, avant d'entamer la Phase 1.

## Definition of Done

- [x] Documents de référence créés et cohérents entre eux
- [x] Structure de monorepo en place
- [x] Modèle de données initial couvrant les entités de la section 53
- [x] Configuration TypeScript strict / ESLint / Prettier / Vitest / CI écrite
- [ ] `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build` exécutés avec succès
      (bloqué dans cette session par la politique réseau — voir ci-dessus, à faire en premier avant
      Phase 1)
- [ ] Première migration Prisma générée et committée
