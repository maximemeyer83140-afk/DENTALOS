# PHASE 4 — Clinique

## Objectifs

Odontogramme interactif et historisé, notes cliniques (finalisées = jamais réécrites en place),
plans de traitement multi-scénarios, devis. Le moteur tarifaire suisse complet (catalogues/
versions/règles) reste Phase 5 — ici, un poste de plan de traitement ou de devis porte un prix
saisi manuellement (`manualPriceAllowed` le permet déjà dans le schéma), sans dépendre d'un
catalogue tarifaire peuplé.

## Changements base de données

Aucun nouveau modèle : `DentalChart`, `DentalChartEntry`, `ClinicalNote`, `ClinicalNoteRevision`,
`TreatmentPlan`, `TreatmentPlanOption`, `TreatmentPlanItem`, `Treatment`, `Quote`, `QuoteItem`
existent depuis la Phase 0 (relations `practitioner` ajoutées en Phase 3).

## Décisions prises dans cette phase

- **Historisation de l'odontogramme** : chaque changement d'état d'une dent crée un **nouveau**
  `DentalChart` (copie de toutes les entrées précédentes + la dent modifiée), marque l'ancien
  `isCurrent: false` et le nouveau `isCurrent: true`. Cohérent avec le principe "jamais
  d'écrasement silencieux" déjà appliqué au profil médical (Phase 2) et aux notes cliniques
  finalisées — et ça rend réellement possible "consulter l'odontogramme à une date antérieure"
  (section 8), pas seulement en théorie dans le schéma.
- **Numérotation des devis** : même pattern que la numérotation patient (Phase 2) — transaction
  Postgres `Serializable` + retentative, scopée par clinique et par année.
- **Devis créé depuis un plan de traitement** : `createQuoteFromPlanOption` copie les postes d'une
  `TreatmentPlanOption` dans un nouveau devis et calcule `subtotal`/`total` via un calculateur
  dédié (pas de recalcul dupliqué dans l'UI, section 79).

## API / logique serveur

- `packages/database/src/repositories/dental-chart.ts` — `getCurrentChart`,
  `getChartAsOf(ctx, patientId, date)`, `recordToothCondition` (transaction de versionnement
  décrite ci-dessus).
- `packages/database/src/repositories/clinical-notes.ts` — `listNotesForPatient`, `createNote`,
  `finalizeNote`, `correctFinalizedNote` (crée une `ClinicalNoteRevision`, refuse de modifier le
  contenu d'une note déjà finalisée autrement que par ce chemin).
- `packages/database/src/repositories/treatment-plans.ts` — `createTreatmentPlan` (avec une
  première option et ses postes), `addTreatmentPlanOption`, `addTreatmentPlanItem`,
  `updateTreatmentPlanStatus`, `updateTreatmentPlanItemStatus`.
- `packages/database/src/services/quote-calculator.ts` — calcule `subtotal`/`taxTotal`/`total`
  à partir des lignes ; seul point du code autorisé à faire ce calcul.
- `packages/database/src/repositories/quotes.ts` — `createQuoteFromPlanOption`,
  `updateQuoteStatus`.

## UI

- Onglet **Clinique** ajouté à `/patients/[id]` : odontogramme cliquable (32 dents, FDI, même
  logique visuelle que le prototype — mais chaque clic est un vrai appel serveur cette fois) +
  liste des notes cliniques + plan de traitement actif.

## Permissions

`clinical.read`, `clinical.write` (déjà présentes depuis la Phase 0).

## Sécurité

- Une note clinique finalisée n'est jamais modifiable via `createNote`/une mise à jour directe —
  seul `correctFinalizedNote` peut y toucher, et il passe systématiquement par une révision.
- Toutes les écritures cliniques passent par `requirePermission(clinicId, "clinical.write")`.

## Tests

- `dental-chart.test.ts` : un changement d'état de dent crée un nouveau chart, l'ancien reste
  consultable et n'est plus `isCurrent`.
- `clinical-notes.test.ts` : une note finalisée n'est jamais éditée en place ; la correction crée
  une révision et le contenu affiché est le nouveau.
- `quotes.test.ts` : numérotation des devis unique sous création concurrente ; le total calculé
  correspond à la somme des lignes.

## Definition of Done

- [x] Repositories et services écrits (odontogramme versionné, notes, plans de traitement, devis)
- [x] Onglet Clinique branché sur `/patients/[id]`
- [x] Tests de versionnement, de révision de notes et de numérotation de devis écrits
- [ ] `pnpm install && pnpm db:migrate && pnpm test` exécutés avec succès — **toujours bloqué**
      (même limitation réseau que les phases précédentes).

## Addendum 1 — statuts explicites des soins et actes (ÉTAPE 6 d'un plan en plusieurs étapes :
Agenda → Fiche patient, sur demande explicite de l'utilisateur ; ÉTAPES 1-5 traitées dans les
addenda précédents de PHASE_3.md et PHASE_2.md)

L'énoncé demande de voir immédiatement, par acte : prévu / réalisé / à facturer / facturé / payé —
et prévient explicitement contre toute « duplication incohérente entre traitement, facture et
paiement ». Or la chaîne `TreatmentPlanItem` (ligne planifiée) → `Quote`/`QuoteItem` (devis) →
`Invoice`/`InvoiceItem` (facture) existait déjà (Phases 4 et 5) mais ne se référençait jamais
elle-même : un `QuoteItem` ne savait pas de quel `TreatmentPlanItem` il venait, une facture ne
savait pas quel acte elle facturait, et le modèle `Treatment` (l'acte réellement effectué — dent,
date, praticien, code tarifaire, prix, statut, exactement les champs demandés par l'énoncé)
existait dans le schéma depuis la Phase 0 mais n'était écrit nulle part. Cette étape ferme cette
chaîne plutôt que d'ajouter un système de suivi parallèle — la source du problème que l'énoncé
signale.

### Changements base de données

- `QuoteItem` : ajout de `treatmentPlanItemId String?` — trace la ligne de devis jusqu'à la ligne
  de plan dont elle vient.
- Aucun autre changement : `Treatment.treatmentPlanItemId` et `InvoiceItem.treatmentId`
  existaient déjà dans le schéma, simplement jamais renseignés par le code applicatif.

### API / logique serveur

- `packages/database/src/repositories/treatments.ts` (nouveau) — `createTreatment`,
  `listTreatmentsForPatient`.
- `packages/database/src/repositories/treatment-plans.ts` :
  - `createTreatmentPlan` crée désormais, dans la même transaction, un `Treatment` pour chaque
    ligne créée directement au statut `completed` (mode « Traitement » — un acte effectué le jour
    même, par opposition à « Devis » — une proposition).
  - `updateTreatmentPlanItemStatus` (signature étendue avec `updatedBy`) crée ce même `Treatment`
    au moment où une ligne planifiée passe à `completed`, si elle n'en a pas déjà un.
  - Nouvelle fonction `listSoinsForPatient` : tous les actes du patient, à plat, avec le statut
    ÉTAPE 6 calculé par ligne.
- `packages/database/src/services/treatment-status.ts` (nouveau) — `computeSoinStatus`, fonction
  pure (aucun accès base, testée isolément) qui dérive le statut affiché uniquement de ce que la
  chaîne réelle contient : pas encore réalisé → **Prévu** ; réalisé sans `Treatment` lié (ne
  devrait arriver que sur d'anciennes données antérieures à ce lien) → **Réalisé** ; `Treatment`
  existant sans ligne de facture → **À facturer** ; facturé mais facture non soldée → **Facturé** ;
  facture au statut `paid` → **Payé** ; ligne de plan annulée/refusée → **Annulé**.
- `packages/database/src/repositories/quotes.ts` — `createQuoteFromPlanOption` copie désormais
  `treatmentPlanItemId` sur chaque `QuoteItem`.
- `packages/database/src/repositories/invoices.ts` — `createInvoiceFromQuote` retrouve, pour
  chaque ligne de devis, le `Treatment` déjà créé pour la même ligne de plan (s'il existe) et
  renseigne `InvoiceItem.treatmentId` en conséquence.

### UI

- `apps/web/src/app/patients/[id]/page.tsx` (onglet « Clinique / Soins ») : tableau « Statut des
  soins » sous l'odontogramme et les notes — acte, dent, praticien, code tarifaire, prix, date de
  réalisation, statut (badge coloré), et un bouton « Marquer réalisé » sur les lignes encore
  « Prévu ».
- `apps/web/src/app/patients/[id]/SoinActions.tsx` (nouveau) — `MarkSoinCompletedButton`, action
  en un clic (même style que `FinalizeNoteButton`).

### Permissions

Inchangées : `clinical.write` pour marquer un acte réalisé (même permission que le reste du
dossier clinique).

### Tests

- `packages/database/src/services/treatment-status.test.ts` (nouveau) — les six statuts de
  `computeSoinStatus`, sans base de données.
- `packages/database/src/repositories/treatment-plans.test.ts` (nouveau) — un acte créé
  directement en mode Traitement obtient son `Treatment` ; un acte planifié marqué réalisé plus
  tard en obtient un aussi (jamais deux) ; un acte suivi du bout en bout (prévu → à facturer →
  facturé → payé) au fur et à mesure que devis puis facture puis paiement sont enregistrés ;
  jamais de fuite entre organisations sur `listSoinsForPatient`.

### Limitation connue

`computeSoinStatus` simplifie « payé » au niveau de la facture entière (`Invoice.status === "paid"`),
pas au prorata de paiements partiels par ligne — cohérent avec le reste de l'app (`PaymentForm`
paie des factures, pas des lignes individuelles) mais à revisiter si un jour la facturation doit
suivre un paiement partiel acte par acte. `pnpm install`/`typecheck`/`lint`/`test`/`build` restent
bloqués dans ce bac à sable — mêmes vérifications de substitution que les étapes précédentes.

## Addendum 2 — onglet Devis (ÉTAPE 7 d'un plan en plusieurs étapes : Agenda → Fiche patient, sur
demande explicite de l'utilisateur ; ÉTAPES 1-6 traitées dans les addenda précédents de
PHASE_3.md, PHASE_2.md et l'addendum 1 ci-dessus)

L'onglet Devis listait déjà les devis (numéro, statut, total), mais sans détail des lignes, sans
action de changement de statut (`updateQuoteStatus` existait déjà côté repository mais n'était
jamais appelé par l'UI), et sans les statuts explicitement demandés (« Partiellement accepté »
n'existait pas encore dans `QuoteStatus`).

### Changements base de données

`QuoteStatus` : ajout de `partially_accepted`.

### API / logique serveur

- `packages/database/src/repositories/quotes.ts` :
  - `listQuotesForPatient` inclut désormais les lignes de chaque devis (le détail complet demandé
    en cliquant sur un devis, sans aller-retour supplémentaire).
  - `updateQuoteStatus` répercute désormais la décision sur les lignes de plan de traitement dont
    le devis vient (via `QuoteItem.treatmentPlanItemId`, ajouté à l'ÉTAPE 6) : « accepté » fait
    passer chaque ligne encore `planned` à `accepted`, « refusé » les fait passer à `rejected`.
    C'est le geste concret derrière « transformer les actes acceptés en plan de traitement » de
    l'énoncé — les lignes sont déjà des `TreatmentPlanItem`, il n'y a rien de plus à créer,
    seulement leur statut à faire avancer. Un devis « partiellement accepté » ne cascade rien :
    sans un accord ligne par ligne (que le modèle actuel ne capture pas), impossible de savoir
    lesquelles ont été retenues — limitation assumée, notée ci-dessous.
- `apps/web/src/app/patients/[id]/actions.ts` — `updateQuoteStatusAction`.

### UI

- `apps/web/src/app/patients/[id]/QuoteRow.tsx` (nouveau) — un devis par ligne, dépliable : détail
  des actes/dents/quantités/prix, boutons de changement de statut (Envoyé, Accepté, Partiellement
  accepté, Refusé selon l'état courant), bouton Facturer une fois accepté, bouton Imprimer (même
  mécanisme `window.print()` + `@media print` scopé par id que `TreatmentPlanForm.tsx`).
- Génération PDF : non implémentée — l'impression navigateur (Ctrl/Cmd+P → « Enregistrer en PDF »)
  en tient lieu, même limitation que pour le QR-code (bibliothèque PDF non disponible, npm bloqué).

### Permissions

Inchangées : `clinical.write` pour changer le statut d'un devis, `invoices.create` pour le
facturer.

### Tests

- `packages/database/src/repositories/quotes.test.ts` (étendu) : chaque ligne de devis référence
  bien la ligne de plan dont elle vient ; accepter un devis fait passer ses lignes planifiées à
  accepté ; refuser un devis les fait passer à refusé ; un devis partiellement accepté ne touche
  aucune ligne.

### Limitation connue

« Partiellement accepté » reste un statut d'ensemble sur le devis, pas un accord ligne par ligne —
capturer précisément quelles lignes ont été retenues demanderait un champ d'acceptation par
`QuoteItem`, non ajouté ici faute de besoin exprimé à ce niveau de détail. `pnpm install`/
`typecheck`/`lint`/`test`/`build` restent bloqués dans ce bac à sable.
