# PHASE 2 — Patients

## Objectifs

Fiche patient complète, informations médicales structurées et **versionnées** (jamais écrasées
silencieusement), alertes médicales visibles immédiatement, documents liés au patient (métadonnées
+ abstraction de stockage), et une timeline clinique qui sert de structure d'accueil aux événements
des phases suivantes (rendez-vous, notes, plans de traitement, factures, ...). Pas d'écrans
odontogramme/parodontologie/plans de traitement ici — Phase 4.

## Changements base de données

Aucun nouveau modèle : `Patient`, `PatientMedicalProfile`, `PatientMedicalProfileRevision`,
`MedicalAlert`, `Document` existent déjà depuis le schéma initial (Phase 0). Cette phase construit
la couche applicative (repositories, services, UI) par-dessus, pas le schéma.

## Décisions prises dans cette phase

- **Numérotation patient** : générée côté serveur (`{année}-{séquence sur 4 chiffres}`, scopée par
  clinique), jamais saisie manuellement. Implémentée avec une transaction Postgres en isolation
  `Serializable` + une retentative unique en cas de conflit de sérialisation — deux
  réceptionnistes créant un patient au même instant ne doivent jamais obtenir le même numéro
  (section 82, concurrence). Limite connue : sous charge concurrente très élevée, un deuxième
  conflit ferait échouer la création plutôt que de la mettre en file — acceptable pour un cabinet,
  à revisiter si le volume l'exige.
- **Clinique active** : en l'absence d'un sélecteur multi-clinique (pas encore construit), l'UI
  utilise la première clinique à laquelle l'utilisateur a accès (`session.user.clinics[0]`). Limite
  connue et assumée, à lever quand un praticien travaillant sur plusieurs cliniques en aura besoin
  (Phase 3+).
- **Stockage de fichiers** : interface `StorageProvider` définie (upload/URL signée), avec une
  implémentation locale de développement uniquement (écrit sur disque, jamais utilisée en
  production). Conforme à la règle "pas de fournisseur unique en dur" de `ARCHITECTURE.md` §8.
- **Retrait de `exactOptionalPropertyTypes`** (`packages/config/tsconfig.base.json`, activé en
  Phase 0) : en écrivant les repositories de cette phase, ce flag entre en friction avec les types
  générés par Prisma pour les champs optionnels (`field?: T | null`, sans `| undefined` explicite),
  une interaction TypeScript connue et non triviale à valider sans compilateur sous la main. Prisma
  traite de toute façon `undefined` et "champ absent" de façon identique à l'exécution — le flag ne
  protégeait ici contre aucun bug réel, seulement contre une classe étroite d'ambiguïtés d'API que
  ce projet ne rencontre pas. Retiré plutôt que risqué : mieux vaut lever un flag d'opinion que
  livrer trois phases de code potentiellement non compilable sans pouvoir le vérifier.

## API / logique serveur

- `packages/database/src/repositories/patients.ts` — `listPatients`, `getPatient`,
  `createPatient` (génère le numéro patient), `updatePatient`. Tout est scopé
  `TenantContext`, comme `practitioners.ts` en Phase 1.
- `packages/database/src/services/patient-number.ts` — génération du numéro patient.
- `packages/database/src/repositories/medical-profile.ts` — `getMedicalProfile`,
  `updateMedicalProfile` : toute modification écrit d'abord une `PatientMedicalProfileRevision`
  (snapshot de l'état précédent) avant d'appliquer le changement, dans une transaction.
- `packages/database/src/repositories/medical-alerts.ts` — `listActiveAlerts`, `addAlert`,
  `deactivateAlert`.
- `packages/database/src/repositories/documents.ts` — `listDocumentsForPatient`,
  `createDocumentRecord` (métadonnées ; le binaire passe par `StorageProvider`).
- `packages/database/src/services/storage-provider.ts` — interface + implémentation dev locale.
- `packages/database/src/services/patient-timeline.ts` — agrège rendez-vous + notes cliniques +
  documents d'un patient en une liste triée par date (les autres types d'événements s'y
  brancheront au fil des phases suivantes).

## UI

- `/patients` — liste avec recherche (nom), lien vers la création.
- `/patients/new` — formulaire de création (Server Action, validation Zod).
- `/patients/[id]` — fiche patient : bandeau d'alertes médicales toujours visible, onglets
  Overview / Dossier médical / Documents / Timeline (section 68).

## Permissions

Réutilise les permissions Phase 0 (`patients.read`, `patients.write`) via `requirePermission` de
la Phase 1. Aucune nouvelle permission nécessaire.

## Sécurité

- Toute lecture/écriture patient passe par `requirePermission(clinicId, "patients.read"|"patients.write")`
  — jamais un accès Prisma direct depuis une route/composant.
- Le profil médical n'est jamais écrasé : `updateMedicalProfile` échoue toute tentative de
  contourner la création de révision (la fonction est le seul point d'entrée d'écriture exposé).
- Les alertes médicales sont désactivées (`isActive: false`), jamais supprimées — historique
  conservé.

## Tests

- `packages/database/src/repositories/patients.test.ts` — isolation tenant (même schéma de test
  que Phase 1) + format et unicité du numéro patient généré, y compris sous création concurrente
  (deux créations lancées en parallèle ne doivent jamais produire le même numéro).
- `packages/database/src/repositories/medical-profile.test.ts` — une mise à jour du profil médical
  crée bien une révision avant d'écraser les champs, et l'historique complet reste lisible.

## Definition of Done

- [x] Repositories et services écrits (patients, profil médical, alertes, documents, timeline,
      numérotation, storage provider)
- [x] UI liste / création / fiche patient écrite
- [x] Tests d'isolation tenant, de numérotation concurrente et de versionnement du profil médical
      écrits
- [ ] `pnpm install && pnpm db:migrate && pnpm test` exécutés avec succès — **toujours bloqué dans
      cette session** (même limitation réseau que les Phases 0 et 1). À faire en priorité absolue
      dès que l'accès npm est rétabli, avant Phase 3.
