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
