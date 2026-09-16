# ARCHITECTURE.md — DentalOS

Ce document décrit l'architecture technique cible de DentalOS, les choix effectués en Phase 0, et
les décisions qui restent ouvertes. Il est le document de référence pour tout nouveau
contributeur (humain ou agent) avant de toucher au code.

## 1. Vision et contraintes produit

DentalOS est un SaaS multi-tenant destiné à des cabinets dentaires suisses, de l'indépendant au
groupe multi-sites. Contraintes structurantes dès le premier commit :

- **Multi-tenant dès le départ** : `Organization → Clinic → {Users, Practitioners, Employees,
  Patients, ...}`. Un utilisateur peut accéder à plusieurs cliniques avec des rôles différents.
- **Isolation stricte des données entre organisations.** Aucune requête ne doit pouvoir traverser
  cette frontière, ni par bug applicatif ni par erreur humaine. Voir §5 et `SECURITY.md`.
- **Données médicales et financières sensibles** → sécurité, traçabilité et intégrité priment sur
  la vitesse de livraison de fonctionnalités.
- **Pas de fournisseur unique structurant.** Stockage fichiers, email, SMS, paiement, signature
  électronique doivent être des adapters interchangeables, pas des appels directs à un SDK
  propriétaire dans le code métier.
- **La complexité doit être dans le système, pas dans l'expérience utilisateur.**

## 2. Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                        apps/web (Next.js)                     │
│  App Router · Server Components · Server Actions / Route      │
│  Handlers · UI (Tailwind + shadcn/ui)                          │
│                                                                 │
│  domain modules (à mesure des phases) :                       │
│  src/modules/{patients,appointments,clinical,billing,          │
│               inventory,finance,...}                           │
│    - schema/  (validation Zod, entrée/sortie)                  │
│    - service/ (règles métier, calculs, transactions)           │
│    - repository/ (accès Prisma, toujours filtré par tenant)    │
│    - ui/ (composants React du module)                          │
└───────────────────────────┬────────────────────────────────────┘
                             │ Prisma Client (types générés)
┌───────────────────────────▼────────────────────────────────────┐
│                  packages/database (@dentalos/database)         │
│  schema.prisma · migrations versionnées · seed · client export  │
└───────────────────────────┬────────────────────────────────────┘
                             │
                      PostgreSQL (16+)
```

`packages/config` fournit la configuration partagée (`tsconfig.base.json`, config ESLint) pour
éviter la dérive entre packages.

Le backend est pour l'instant intégré à Next.js (Route Handlers / Server Actions), pas un service
séparé — voir décision D1 ci-dessous pour les conditions d'extraction future.

## 3. Stack retenue (Phase 0)

| Domaine | Choix | Justification |
| --- | --- | --- |
| Langage | TypeScript strict (partout) | Cohérence avec l'exigence "fortement typé", un seul langage frontend/backend |
| Frontend | Next.js (App Router) + React | Stack moderne, SSR/RSC, écosystème mature, aligné avec la demande initiale |
| Style | Tailwind CSS + shadcn/ui + Lucide | Design system premium, composants accessibles, pas de lock-in visuel |
| Base de données | PostgreSQL 16+ | Transactions ACID, contraintes fortes, types `NUMERIC`/`JSON` adaptés à la finance et au médical |
| ORM | Prisma | Fortement typé, migrations versionnées lisibles, écosystème mature, `Decimal` natif |
| Monorepo | pnpm workspaces | Rapide, `workspace:*`, pas de magie superflue (pas de Nx/Turborepo tant que la taille ne le justifie pas) |
| Tests unitaires/intégration | Vitest | Rapide, API compatible Jest, bonne intégration Vite/Next |
| Tests E2E | Playwright (à activer Phase 10) | Navigateur pré-installé dans les environnements CI/agent |
| Lint/format | ESLint (flat config) + Prettier | Standard, `typescript-eslint` |
| CI | GitHub Actions | Déjà le remote Git utilisé par le projet |

## 4. Monorepo — structure des dossiers

```
apps/web/                 Application Next.js (UI + API)
  src/app/                 Routes (App Router)
  src/modules/              Modules métier (créés au fur et à mesure des phases)
  src/lib/                  Utilitaires transverses (cn(), etc.)
packages/database/         Schéma Prisma, migrations, client, seed, permissions RBAC
packages/config/           tsconfig et eslint config partagés
docs/phases/                Un document par phase (objectifs, DB, API, UI, sécurité, DoD)
.github/workflows/          CI
```

Règle : le code métier (calculs financiers, règles cliniques, RBAC) vit dans des **services**
séparés des composants UI et des routes API (section 78/79 du cahier des charges). Un composant ne
recalcule jamais un montant ; il appelle un service centralisé (`InvoiceCalculator`,
`CompensationCalculator`, `TariffCalculator`, ...). Ces services arrivent avec les phases qui en
ont besoin (Phase 5 pour la facturation, etc.) — Phase 0 ne fait qu'poser la structure de dossiers
et la convention.

## 5. Multi-tenancy et isolation des données

- Hiérarchie : `Organization` (1) → `Clinic` (N) → `Patient/Practitioner/Employee/Appointment/...`
  (N par clinique).
- **Décision de modélisation** : `organizationId` est stocké comme colonne indexée dénormalisée sur
  toutes les tables scopées tenant, pour permettre un filtrage rapide (`WHERE organizationId = ?`)
  sans jointure. L'intégrité référentielle vers `Organization` :
  - pour les tables scopées à une clinique (la majorité), elle est assurée **transitivement** via
    la relation réelle `clinicId → Clinic → Organization` ;
  - pour les tables scopées à l'organisation sans notion de clinique (`Role` système,
    `TariffCatalog`, `Supplier`, `Laboratory`, `Payer`, `FeatureFlag`, `WebhookEndpoint`), il n'y a
    pas de contrainte FK Prisma dédiée : `organizationId` est validé côté applicatif.
- **Référence d'audit sans FK forte.** Les colonnes `createdBy` / `updatedBy` / `assignedToUserId`
  / `uploadedBy` stockent un id `User` en texte simple, **sans** relation Prisma formelle. Ce choix
  délibéré évite une explosion de 50+ relations inverses sur le modèle `User` (douleur connue de
  Prisma à cette échelle) tout en restant indexable et auditable. Compromis documenté, pas un
  oubli.
- **Règle absolue** : toute requête applicative doit filtrer par tenant. Ceci ne doit jamais
  reposer uniquement sur le frontend. La Phase 1 doit livrer une couche repository qui injecte
  systématiquement `organizationId`/`clinicId` à partir du contexte de session, jamais depuis un
  paramètre client non vérifié.
- **Test non négociable** (section 64) : un utilisateur de l'Organization A ne doit jamais pouvoir
  lire ou écrire une donnée de l'Organization B. Ce test s'écrit en Phase 1 dès que
  l'authentification existe, avant toute fonctionnalité métier.

## 6. Argent, dates, identifiants

- **Argent** : `Decimal` Prisma (`@db.Decimal(12,2)` en général) → `NUMERIC` Postgres. Jamais de
  `Float`. Chaque document financier racine (`Invoice`, `Quote`, `Payment`, `CreditNote`,
  `Expense`, `RecurringExpense`, `CompensationStatement`, `Goal`) porte une `currency` explicite
  (`CHF` par défaut) ; les lignes héritent de la devise du document parent.
- **Dates/heures** : `DateTime` Prisma (`timestamptz` Postgres), fuseau par défaut
  `Europe/Zurich` configurable par clinique.
- **Identifiants** : `cuid()` (`String @id @default(cuid())`) partout — triable, sans collision,
  pas besoin d'extension Postgres contrairement à `uuid()`.
- **Tables** mappées en `snake_case` via `@@map` ; colonnes en `camelCase` (défaut Prisma). Choix
  pragmatique : SQL propre sans le coût de maintenance d'un `@map` sur chaque champ.

## 7. RBAC (aperçu — détail dans SECURITY.md)

`Permission` (clé globale du type `patients.read`) → `RolePermission` → `Role` (scope
organisation, ou système) → `UserClinicAccess` (association *utilisateur × clinique × rôle*).
Toute vérification de permission est faite **côté serveur**, jamais uniquement dans l'UI.

## 8. Abstractions d'intégration (obligatoire avant tout branchement réel)

Ne jamais appeler un SDK tiers directement depuis le code métier. Chaque famille d'intégration a
une interface définie dans le module qui en a besoin, avec une implémentation "provider" injectée :

| Domaine | Interface prévue | Implémentation Phase 0 |
| --- | --- | --- |
| Stockage fichiers | `StorageProvider` | Aucune — à définir Phase 2 (Documents) |
| Email | `EmailProvider` | Aucune — à définir Phase 9 |
| SMS | `SmsProvider` | Aucune — à définir Phase 9 |
| Paiement (terminal/en ligne) | `PaymentGateway` | Aucune — hors scope MVP, Phase 5+ |
| Signature électronique | `ESignatureProvider` | Aucune — Phase 4 (consentements) |
| QR-facture suisse | `SwissQrBillService` | Aucune — Phase 5, doit implémenter le standard officiel, pas un simple QR visuel |

## 9. Décisions à prendre avant d'aller plus loin

Ces décisions ont un impact structurant ; elles doivent être tranchées explicitement au plus tard
en début de Phase 1, pas laissées implicites.

1. **Authentification** : Auth.js (NextAuth) vs. solution maison vs. fournisseur managé
   (ex. Clerk/WorkOS). Impacte le schéma (tables de session), MFA, et le modèle de coût. Le schéma
   Phase 0 ne modélise **pas** encore de tables de session/compte pour rester neutre vis-à-vis de
   ce choix.
2. **Multi-organisation par utilisateur** : le schéma actuel suppose `User.organizationId` unique
   (un utilisateur appartient à une seule organisation, mais peut accéder à plusieurs cliniques de
   celle-ci via `UserClinicAccess`). Un comptable externe intervenant sur plusieurs organisations
   n'est pas couvert — à valider avec le métier avant Phase 1.
3. **Système(s) tarifaire(s) suisse(s) à supporter en premier** (ex. SSO, LAMal/OPAS, tarifs
   privés) — impacte le contenu initial de `TariffCatalog`/`TariffVersion`/`TariffItem`, pas la
   structure (déjà générique par design, voir `DATABASE.md`).
4. **Hébergement/infrastructure** : Suisse vs. UE avec garanties contractuelles équivalentes ;
   fournisseur de base de données managée (impacte chiffrement au repos, sauvegardes, DPA). Voir
   `COMPLIANCE.md`.
5. **Extraction éventuelle d'un backend dédié** hors Next.js : à ne faire que si un besoin concret
   apparaît (job asynchrones lourds, contrainte d'échelle) — pas par anticipation.
6. **Tailwind v3 vs v4** : Phase 0 fixe Tailwind 3.4 (compatibilité shadcn/ui la plus éprouvée au
   moment de l'écriture) ; réévaluer avant de construire le design system complet (Phase 1 UI).
7. **i18n** : framework (`next-intl` pressenti) non encore câblé — seule la colonne `Locale`
   (`fr/de/it/en`) existe dans le schéma. À implémenter dès les premiers écrans (Phase 1), pas
   après coup, pour éviter de re-story tous les textes.

## 10. Ce que Phase 0 livre — et ce qu'elle ne livre pas

Livré : structure monorepo, configuration TypeScript strict/ESLint/Prettier/Vitest/CI, modèle de
données initial complet (voir `DATABASE.md`), documents de référence.

Non livré (intentionnellement) : authentification fonctionnelle, UI des modules métier, moteur de
calcul (facturation, rétrocessions, tarifs), intégrations externes, RBAC appliqué au runtime. Ces
éléments arrivent phase par phase (`ROADMAP.md`), chacune précédée de son propre
`docs/phases/PHASE_X.md`.
