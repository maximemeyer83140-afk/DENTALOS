# PHASE 16 — Ordonnances (ÉTAPE 20)

## Contexte

Demande explicite de l'utilisateur, après un tour d'audit de ce qui existait déjà en vrai code vs
dans la démo HTML autonome (Artifact) construite en parallèle pendant plusieurs sessions : les
Ordonnances n'existaient nulle part côté vrai backend — ni modèle Prisma, ni repository, ni UI —
alors même que l'enum `DocumentCategory` prévoyait déjà la valeur `prescription` depuis la Phase 0.
Tout le reste de ce qui avait été reconstruit dans la démo (Consentements, Communications, Rappels,
Notes cliniques) existait déjà réellement ; Ordonnances était le seul vrai trou.

## Décisions de conception

**Suit exactement le patron de `ClinicalNote`/`Consent`.** `Prescription` porte `organizationId`,
`clinicId`, `patientId`, `practitionerId` (relation, comme `ClinicalNote.practitionerId`) et un
`documentId` optionnel — même principe que `Consent.documentId` : un lien vers un vrai fichier
imprimé/numérisé existe seulement si quelqu'un l'a effectivement créé, jamais auto-généré. Cette
phase ne construit pas ce flux d'upload (`linkPrescriptionDocument` existe côté repository, prêt à
être appelé, mais rien ne l'appelle encore) — voir Limitations connues.

**Les lignes de médicaments sont une vraie table, pas du JSON.** `PrescriptionItem` (medication,
dosage, duration) suit `QuoteItem`/`InvoiceItem`, pas `PatientMedicalProfile.medications` (qui,
lui, est un blob JSON) — une ordonnance est un document légal daté avec un contenu figé au moment
de la création/modification, pas un profil qu'on met à jour en continu.

**"Remplir directement sur KUSP avant impression" = édition et aperçu d'impression au même endroit.**
Plutôt que trois écrans séparés (formulaire de création, vue en lecture seule, aperçu d'impression),
`PrescriptionRow` n'en a qu'un : les champs médicament/posologie/durée sont des `<input>` éditables
sur le même rendu qui sera imprimé (id `prescription-printable-{id}`), "Enregistrer" remplace la
liste en base (`updatePrescription` — supprime les anciennes lignes, recrée les nouvelles, pas de
diff), "Imprimer" appelle `window.print()` sur ce même rendu. Reprend la technique déjà en place
dans `QuoteRow.tsx` (isolation CSS `@media print` scoping sur un id, classe `*-no-print` pour les
boutons) plutôt que d'inventer un nouveau mécanisme — avec un ajout : les `<input>`/`<textarea>`
dans la zone imprimable perdent leur bordure/fond à l'impression (`#id input { border: none }`)
pour ne pas imprimer des cases de formulaire.

**Une ordonnance ne peut jamais être vide.** `createPrescription`/`updatePrescription` refusent
zéro ligne (erreur explicite, pas une contrainte DB silencieuse) — comme le plan de traitement
refuse une option sans acte.

## Changements base de données

- `Prescription` (nouveau modèle) : `id`, `organizationId`, `clinicId`, `patientId`,
  `practitionerId`, `notes?`, `documentId?`, `createdAt`, `createdBy?`. Relations : `patient`
  (`onDelete: Cascade`), `practitioner` (`onDelete: Restrict`, comme `ClinicalNote`), `items`.
- `PrescriptionItem` (nouveau modèle) : `id`, `prescriptionId`, `medication`, `dosage`, `duration`.
  `onDelete: Cascade` depuis `Prescription`.
- `Patient.prescriptions` et `Practitioner.prescriptions` : relations inverses ajoutées.
- **Aucune migration Prisma générée** — voir Limitations connues : cet environnement n'a jamais eu
  accès à `registry.npmjs.org` (confirmé refusé explicitement par la politique d'egress réseau),
  donc ni le CLI Prisma ni aucun package du monorepo n'ont pu être installés ici. Il n'existe déjà
  aucun dossier `packages/database/prisma/migrations/` dans ce dépôt malgré 15 phases précédentes
  de changements de schéma (le modèle complet date de la Phase 0 et n'avait plus bougé depuis les
  ÉTAPES 7-9) — `schema.prisma` a toujours été la seule source vérifiée à la main, jamais
  passée par `prisma migrate dev`/`prisma validate` dans aucune session précédente non plus
  (PHASE_15.md documente déjà la même limitation réseau). **Avant tout déploiement**, il faut
  exécuter `pnpm db:generate && pnpm db:migrate` (ou `prisma migrate dev --name init` en premier
  pour établir la toute première migration sur l'ensemble du schéma existant) depuis un
  environnement avec accès réseau.

## Fichiers

- `packages/database/prisma/schema.prisma` — modèles `Prescription`/`PrescriptionItem`, relations
  inverses sur `Patient`/`Practitioner`.
- `packages/database/src/repositories/prescriptions.ts` (nouveau) — `listPrescriptionsForPatient`,
  `createPrescription`, `updatePrescription` (remplace la liste entière), `linkPrescriptionDocument`.
- `packages/database/src/repositories/prescriptions.test.ts` (nouveau) — création, refus de liste
  vide, isolation multi-tenant (patient et praticien d'une autre organisation), remplacement des
  lignes, liaison à un document, refus de modifier l'ordonnance d'une autre organisation.
- `packages/database/src/index.ts` — export du nouveau repository.
- `apps/web/src/lib/validation/clinical.ts` — `prescriptionLineSchema`, `createPrescriptionSchema`,
  `updatePrescriptionSchema` (même sérialisation `linesJson` que `createTreatmentPlanSchema`).
- `apps/web/src/app/patients/[id]/actions.ts` — `createPrescriptionAction`,
  `updatePrescriptionAction`, permission `clinical.write` (aucune nouvelle clé de permission :
  une ordonnance est un acte clinique comme une note, pas un nouveau domaine).
- `apps/web/src/app/patients/[id]/PrescriptionForm.tsx` (nouveau) — création, lignes dynamiques.
- `apps/web/src/app/patients/[id]/PrescriptionRow.tsx` (nouveau) — édition + aperçu + impression
  réunis, voir Décisions de conception.
- `apps/web/src/app/patients/[id]/page.tsx` — section "Ordonnances" dans l'onglet Clinique / Soins,
  entre "Notes cliniques" et "Statut des soins".

## Sécurité

Mêmes garde-fous que le reste de l'onglet Clinique : `requirePermission(clinicId, "clinical.write")`
sur les deux Server Actions, et chaque fonction du repository revérifie `organizationId`/`clinicId`
dans sa clause `where` (jamais seulement l'id) — un utilisateur d'une autre organisation obtient
`NotFoundError`, jamais une fuite de données ni un accès en écriture croisé (couvert par les tests).

## Tests

`prescriptions.test.ts` écrit et vérifié syntaxiquement (`node --experimental-strip-types --check`,
qui passe sans erreur sur les deux fichiers `.ts` de cette phase) mais **jamais exécuté contre une
vraie base** : `pnpm install` échoue dans cet environnement (403 explicite du proxy réseau sur
`registry.npmjs.org` — "Host not in allowlist", pas une erreur transitoire), donc ni `vitest`, ni
`tsc`, ni `eslint`, ni même `prisma generate` n'ont pu tourner ici. Un Postgres 16 local a bien été
démarré dans ce conteneur pour essayer, mais sans le CLI Prisma installé il ne sert à rien pour
cette phase. Les fichiers `.tsx` n'ont même pas de vérification syntaxique possible sans npm (JSX
n'est pas supporté par `node --check`) — seul un comptage manuel des accolades/parenthèses/crochets
a été fait (équilibré sur les deux fichiers), même méthode que celle déjà documentée en PHASE_15
pour la même raison.

**Avant tout déploiement réel**, exécuter dans un environnement avec accès réseau : `pnpm install`,
`pnpm db:generate`, `pnpm db:migrate` (première migration à générer, voir ci-dessus), puis
`pnpm typecheck && pnpm lint && pnpm test`.

## Limitations connues

- **`documentId` sans flux d'upload branché.** Le champ existe et `linkPrescriptionDocument` est
  prêt côté repository, mais rien dans l'UI ne permet encore de lier une ordonnance à un vrai
  fichier scanné/exporté (comme `Consent.documentId` avant que son propre flux ne soit construit).
- **Aucun PDF réel généré.** "Imprimer" reste le rendu HTML du navigateur imprimé via CSS
  (`window.print()`), comme `QuoteRow` — pas de génération PDF côté serveur.
- **Code entièrement non vérifié.** Voir section Tests : aucune exécution réelle n'a eu lieu dans
  cette session, contrairement à ce que les messages de commit des phases précédentes laissaient
  entendre ("Verify, commit and push") alors qu'elles avaient la même contrainte réseau non
  résolue.
- **Dashboard, Liste d'attente (UI) et aperçu d'impression pour les devis** restent hors scope de
  cette phase — identifiés lors de l'audit mais pas construits ici (le Dashboard `/` est toujours
  le placeholder Phase 1 ; `waiting-list.ts` existe côté repository sans aucune UI qui l'utilise).

## Definition of Done

- [x] Modèles `Prescription`/`PrescriptionItem` + relations inverses.
- [x] Repository avec isolation multi-tenant + tests.
- [x] Validation Zod (lignes dynamiques en JSON, même patron que le plan de traitement).
- [x] Server Actions (`clinical.write`).
- [x] UI : création (lignes dynamiques) + édition/impression réunies, section dans l'onglet
      Clinique / Soins.
- [x] Vérification syntaxique disponible sans npm (`node --check` sur les `.ts`, comptage de
      symboles équilibrés sur les `.tsx`).
- [ ] **Migration Prisma générée et appliquée** — impossible sans accès réseau dans cette session.
- [ ] **`pnpm install`/`typecheck`/`lint`/`test` exécutés au moins une fois** — jamais fait dans
      cette session ni, semble-t-il, dans aucune session précédente de ce projet.
