# DentalOS

Le système d'exploitation du cabinet dentaire suisse — plateforme SaaS de gestion de cabinet et
clinique dentaire (patients, agenda, dossier clinique, facturation, stocks, finances, analytics).

> Statut : **Phase 0 — fondations**. Voir [`ROADMAP.md`](./ROADMAP.md) pour le plan de phases et
> [`docs/phases/`](./docs/phases) pour le détail de chaque phase.

## Documentation

| Document | Contenu |
| --- | --- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Vue d'ensemble technique, choix de stack, décisions ouvertes |
| [`DATABASE.md`](./DATABASE.md) | Modèle de données, conventions, index, intégrité |
| [`SECURITY.md`](./SECURITY.md) | Modèle de menaces, contrôles techniques, RBAC |
| [`COMPLIANCE.md`](./COMPLIANCE.md) | Exigences suisses identifiées, hypothèses, points à valider |
| [`ROADMAP.md`](./ROADMAP.md) | Phases de développement et definition of done |

## Stack

- **Frontend** : Next.js (App Router) · React · TypeScript strict · Tailwind CSS · shadcn/ui · Lucide
- **Backend** : Next.js server-side (API routes / server actions) · PostgreSQL · Prisma
- **Monorepo** : pnpm workspaces (`apps/web`, `packages/database`, `packages/config`)

## Prérequis

- Node.js 22+ (voir `.nvmrc`)
- pnpm 10+ (`corepack enable`)
- PostgreSQL 15+ local ou distant

## Installation

```bash
pnpm install
cp .env.example apps/web/.env.local
cp packages/database/.env.example packages/database/.env
# éditer DATABASE_URL dans les deux fichiers pour pointer vers votre Postgres local

pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Scripts

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Lance l'app Next.js en développement |
| `pnpm build` | Build de tous les packages |
| `pnpm lint` | ESLint sur tout le monorepo |
| `pnpm typecheck` | `tsc --noEmit` sur tout le monorepo |
| `pnpm test` | Tests unitaires (Vitest) sur tout le monorepo |
| `pnpm format` | Formatage Prettier |
| `pnpm db:migrate` | Applique les migrations Prisma (dev) |
| `pnpm db:seed` | Recharge les données de développement fictives |

## Structure du dépôt

```
apps/web/            Application Next.js (UI + API)
packages/database/    Schéma Prisma, migrations, client, seed
packages/config/      Configuration partagée (tsconfig, eslint)
docs/phases/           Un document par phase de développement
```

## Sécurité et données

Ce logiciel manipule des données médicales et financières sensibles. Ne jamais utiliser de
véritables données patient en développement — voir [`SECURITY.md`](./SECURITY.md) et
[`COMPLIANCE.md`](./COMPLIANCE.md).
