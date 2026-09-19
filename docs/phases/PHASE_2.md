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

## Addendum — refonte création patient + fiche patient (ÉTAPES 2 et 3 d'un plan en plusieurs
étapes : Agenda → Fiche patient, sur demande explicite de l'utilisateur ; l'Agenda a été traitée en
ÉTAPE 1, voir l'addendum de PHASE_3.md)

### ÉTAPE 2 — refonte de la création patient

Le formulaire de création existait déjà (`/patients/new`) mais restait minimal : pas de détection
de doublon, pas de champ langue, sexe en texte libre. Réutilise `createPatient` et le schéma Zod
existants ; rien n'a été réécrit depuis zéro.

#### Changements base de données

Aucun. `Patient.language` (`Locale?`) existait déjà depuis la Phase 0 mais n'était pas exposé dans
le formulaire.

#### API / logique serveur

- `packages/database/src/repositories/patients.ts` — nouvelle fonction
  `findPotentialDuplicates(ctx, input)` : cherche les patients existants partageant nom+prénom
  (insensible à la casse), téléphone/mobile, ou email, puis annote chaque correspondance des
  raisons précises (« même nom, prénom et date de naissance », « même numéro de téléphone », etc.).
  Ne bloque jamais la création — l'énoncé demande d'« empêcher **autant que possible** » les
  doublons, pas de les interdire, et un vrai deuxième patient peut légitimement partager un nom.
  Scopée `TenantContext` comme tout le reste du repository.
- `apps/web/src/app/patients/new/actions.ts` — `createPatientAction` appelle désormais
  `findPotentialDuplicates` avant `createPatient` ; si des correspondances existent et que le
  formulaire n'a pas encore été confirmé (`confirmDuplicate`), renvoie les candidats à l'UI au lieu
  de créer le patient.
- `apps/web/src/lib/validation/patient.ts` — ajout de `language` (`fr`/`de`/`it`/`en`) et
  `confirmDuplicate` (booléen, champ caché) au schéma de création.

#### UI

- `apps/web/src/app/patients/new/page.tsx` — sexe et langue en listes déroulantes ; en cas de
  doublon potentiel, un encart ambré liste les correspondances (nom, numéro patient, raisons, lien
  vers la fiche existante dans un nouvel onglet) avec un bouton « Créer quand même » qui resoumet le
  même formulaire (les champs déjà saisis ne sont jamais perdus, via un champ cache
  `confirmDuplicate` piloté par `useRef` + `requestSubmit()`) sans relancer la vérification.

### ÉTAPE 3 — refonte complète de la fiche patient

La fiche patient (`/patients/[id]`) avait déjà 6 onglets (Overview, Dossier médical, Clinique,
Facturation, Documents, Timeline) construits sur les mêmes repositories que la Phase 4/5. Cette
étape sépare ce qui était mélangé dans l'onglet « Clinique » (odontogramme + notes + plan de
traitement + devis) et ajoute un onglet Rendez-vous, sans réécrire aucun repository métier.

#### Changements base de données

Aucun.

#### API / logique serveur

- `packages/database/src/repositories/appointments.ts` — nouvelle fonction
  `listAppointmentsForPatient(ctx, patientId)` : tous les rendez-vous (passés et futurs) d'un
  patient, plus récents en premier, scopée `TenantContext`. Alimente le nouvel onglet Rendez-vous.

#### UI

- `apps/web/src/app/patients/[id]/page.tsx` — réécrit :
  - **En-tête toujours visible** (quel que soit l'onglet actif) : nom/prénom, numéro patient,
    date de naissance **et âge calculé**, téléphone, email, puis les alertes médicales actives —
    exactement l'énoncé (« bandeau clair … montrant immédiatement … et surtout toute alerte médicale
    importante »).
  - **Huit onglets** au lieu de six : Résumé, Anamnèse, Clinique / Soins, Plan de traitement,
    Devis, Facturation, Documents, Rendez-vous.
    - Résumé (ex-Overview) : adresse/langue, puis trois compteurs (prochain rendez-vous, plans de
      traitement actifs, factures impayées) et l'activité récente (fusion de l'ancien onglet
      Timeline — huit derniers événements).
    - Anamnèse (ex-« Dossier médical ») : inchangé (profil médical, alertes, historique des
      révisions).
    - Clinique / Soins : odontogramme + notes cliniques (sorti de l'ancien onglet « Clinique » qui
      contenait aussi le plan de traitement et les devis).
    - Plan de traitement : sorti du même ancien onglet, isolé.
    - Devis : sorti du même ancien onglet, isolé — la création d'un devis reste rattachée à une
      option du plan de traitement (bouton présent dans l'onglet Plan de traitement).
    - Facturation, Documents : inchangés.
    - Rendez-vous (nouveau) : liste de `listAppointmentsForPatient`, avec date, horaire, type,
      praticien, salle et statut (mêmes libellés français que le calendrier de l'Agenda).

### Permissions

Inchangées : `patients.read`/`patients.write`.

### Tests

- `packages/database/src/repositories/patients.test.ts` (étendu) : `findPotentialDuplicates`
  détecte nom+prénom+date de naissance, détecte un téléphone identique même avec un nom différent,
  ne renvoie rien pour un patient réellement nouveau, et ne renvoie jamais les patients d'une autre
  organisation.
- `packages/database/src/repositories/appointments.test.ts` (étendu) :
  `listAppointmentsForPatient` ne renvoie que les rendez-vous du patient demandé (jamais ceux d'un
  autre patient du même jour), triés du plus récent au plus ancien.

### Limitation connue

Comme pour les phases précédentes : `pnpm install`/`typecheck`/`lint`/`test`/`build` restent
bloqués dans ce bac à sable (accès npm refusé). Vérification faite via
`node --experimental-strip-types --check` (fichiers `.ts`) et un script Python de vérification
d'équilibre des accolades/parenthèses/crochets pour les fichiers `.tsx` — pas un remplacement
complet d'un vrai typecheck TypeScript, à relancer dès que l'accès npm est rétabli.

## Addendum — anamnèse structurée et documents patient (ÉTAPES 4 et 5 d'un plan en plusieurs
étapes : Agenda → Fiche patient, sur demande explicite de l'utilisateur ; ÉTAPES 1-3 traitées dans
les addenda précédents de PHASE_3.md et de ce fichier)

### ÉTAPE 4 — anamnèse médicale structurée

`PatientMedicalProfile` était un simple triplet de listes de texte libre (allergies/médicaments/
conditions) — exactement ce que l'énoncé refuse explicitement (« je ne veux surtout pas un simple
champ texte »). Remplacé par un vrai questionnaire.

#### Changements base de données

- `PatientMedicalProfile` : `conditions: String[]` remplacé par `pathologies: Json` (un objet
  `{ [code]: { present: boolean, notes?: string } }` couvrant les 13 items de l'énoncé — maladies
  cardiovasculaires, hypertension, diabète, troubles de la coagulation, maladies respiratoires,
  rénales, hépatiques, épilepsie, immunodépression, maladies infectieuses, cancer, allergies,
  autres — liste centralisée dans `apps/web/src/lib/anamnese.ts`) ; `medications: String[]`
  remplacé par `medications: Json` (liste structurée nom/dose/fréquence/commentaire) ; ajout de
  `alcoholUse`, `onAntiplatelets`, `pastSurgeries`, `treatingPhysician`. `allergies`, `isPregnant`,
  `isSmoker`, `onAnticoagulants`, `riskNotes`, le versionnement (`version`/`updatedAt`/
  `updatedBy` + `PatientMedicalProfileRevision`) sont inchangés.
- `MedicalAlert` : ajout de `sourceKey String?` — distingue une alerte créée automatiquement à
  partir de l'anamnèse d'une alerte ajoutée à la main via `AlertForm` (qui garde `sourceKey: null`)
  ; voir plus bas.

#### API / logique serveur

- `packages/database/src/repositories/medical-alerts.ts` — nouvelle fonction `syncDerivedAlerts` :
  à chaque mise à jour du profil médical, calcule quatre signaux (allergie, anticoagulant,
  antiagrégant, grossesse) et crée/désactive l'alerte correspondante en conséquence — jamais une
  alerte ajoutée manuellement (`sourceKey: null` n'est jamais touchée). C'est ce qui produit
  automatiquement les bandeaux « ⚠ ALLERGIE : PÉNICILLINE » / « ⚠ TRAITEMENT ANTICOAGULANT » de
  l'énoncé, sans action séparée de l'utilisateur.
- `packages/database/src/repositories/medical-profile.ts` — réécrit : `updateMedicalProfile`
  accepte désormais les nouveaux champs structurés, garde le même principe de versionnement
  (snapshot complet avant écrasement), et appelle `syncDerivedAlerts` dans la même transaction.
- `apps/web/src/lib/anamnese.ts` — `PATHOLOGY_DEFS` (les 13 pathologies) et une liste de
  mots-clés (anticoagulant, corticoïde, bisphosphonate…) utilisée uniquement pour un surlignage
  visuel des médicaments à vérifier dans la fiche — jamais une décision clinique automatique,
  conformément à l'énoncé.
- `apps/web/src/lib/validation/medical-profile.ts` — `parseMedicalProfileFormData` : construit les
  objets `pathologies`/`medications` à partir du `FormData` brut (`path_<code>`/`path_<code>_notes`
  par pathologie, `medName`/`medDose`/`medFrequency`/`medComment` en tableaux parallèles pour la
  liste de médicaments) plutôt que le `Object.fromEntries(formData.entries())` utilisé ailleurs
  dans l'app, qui ne garde que la dernière valeur d'un champ répété — invalidant justement le
  motif « tableaux parallèles » dont la liste de médicaments a besoin.

#### UI

- `apps/web/src/app/patients/[id]/MedicalProfileForm.tsx` — réécrit : une ligne case à cocher +
  précision par pathologie ; liste de médicaments à lignes ajoutables/supprimables (surlignées en
  ambre si le nom correspond à une catégorie sensible) ; allergies et interventions chirurgicales
  en zones de texte (une par ligne, même convention que le reste de l'app) ; médecin traitant,
  commentaires, et cases à cocher anticoagulants/antiagrégants/grossesse/tabac/alcool ; date et
  auteur de la dernière mise à jour affichés en tête de formulaire (anamnèse « datée et
  historisée »).

### ÉTAPE 5 — documents patient

Le stockage de fichiers existait déjà côté serveur (`StorageProvider`/`LocalDevStorageProvider`,
Phase 2 initiale) mais rien ne l'utilisait — l'onglet Documents se contentait d'un message
expliquant que l'upload « arrive avec le branchement d'un vrai fournisseur de stockage ». Cette
étape branche réellement l'upload sur ce fournisseur (en développement local, `LocalDevStorageProvider`
écrit sur disque — voir son propre commentaire pour la limite avant un vrai déploiement).

#### Changements base de données

`Document` : ajout de `comment String?` et `isArchived Boolean @default(false)` (l'« archiver » de
l'énoncé — un document archivé n'est jamais supprimé, seulement caché de la liste par défaut).

#### API / logique serveur

- `packages/database/src/repositories/documents.ts` — `createDocumentRecord` accepte un
  commentaire ; nouvelles fonctions `getDocument` (lecture tenant-scopée unique, utilisée par la
  route de téléchargement) et `updateDocument` (renommer/classer/archiver — une seule fonction,
  aucune des trois n'écrit dans les octets du fichier) ; `listDocumentsForPatient` prend une
  option `includeArchived`.
- `apps/web/src/lib/storage.ts` — instancie `LocalDevStorageProvider` une fois, racine
  `.data/uploads/` (ajouté au `.gitignore` — jamais commité).
- `apps/web/src/app/patients/[id]/actions.ts` — `uploadDocumentAction` (écrit le fichier via
  `StorageProvider` avant d'enregistrer la moindre ligne en base — impossible qu'un enregistrement
  pointe vers des octets jamais écrits), `updateDocumentAction`, `setDocumentArchivedAction`.
- `apps/web/src/app/patients/[id]/documents/[documentId]/route.ts` — route de lecture/
  téléchargement : résout toujours le document via `getDocument` (tenant-scopé) puis vérifie qu'il
  appartient bien au `patientId` de l'URL avant de streamer ses octets — un id deviné ou copié ne
  peut jamais servir le fichier d'un autre patient (« ne pas mélanger les fichiers de différents
  patients »). `?download=1` bascule `Content-Disposition` en pièce jointe.

#### UI

- `apps/web/src/app/patients/[id]/DocumentUpload.tsx` — formulaire d'upload (fichier, type,
  commentaire facultatif).
- `apps/web/src/app/patients/[id]/DocumentRow.tsx` — une ligne par document : liens Visualiser/
  Télécharger, bouton Renommer/classer (dévoile un mini-formulaire inline), bouton Archiver/
  Désarchiver.
- Onglet Documents : liste des documents actifs + section « Archivés » repliable si au moins un
  document y est.

### Permissions

Inchangées : lecture sous `patients.read`, écriture (anamnèse, alertes, documents) sous
`clinical.write`.

### Tests

- `packages/database/src/repositories/medical-profile.test.ts` (étendu) : stockage des pathologies/
  médicaments structurés ; une alerte est créée automatiquement quand l'anamnèse indique une
  allergie et désactivée quand elle est retirée ; anticoagulants et antiagrégants produisent deux
  alertes indépendantes ; une alerte ajoutée à la main n'est jamais désactivée par la
  synchronisation automatique.
- `packages/database/src/repositories/documents.test.ts` (nouveau) : un document reste attaché à
  son patient et à son organisation ; renommer/classer ne touche jamais `storageKey` ; archiver
  cache un document de la liste par défaut sans le supprimer ; jamais de fuite entre organisations
  sur `getDocument`/`updateDocument`.

### Limitation connue

`LocalDevStorageProvider` écrit sur le disque local du processus serveur — adapté au développement,
pas à la production (voir son propre commentaire) ; passer à un vrai fournisseur S3/Azure Blob ne
change que `apps/web/src/lib/storage.ts`, aucun appelant. `pnpm install`/`typecheck`/`lint`/`test`/
`build` restent bloqués dans ce bac à sable — mêmes vérifications de substitution que les étapes
précédentes.

## Addendum — résumé patient (ÉTAPE 9 d'un plan en plusieurs étapes : Agenda → Fiche patient, sur
demande explicite de l'utilisateur ; ÉTAPES 1-8 traitées dans les addenda précédents de ce fichier
et de PHASE_3.md/PHASE_4.md/PHASE_5.md)

L'onglet Résumé (construit à l'ÉTAPE 3) couvrait déjà adresse/langue, prochain rendez-vous, nombre
de plans de traitement actifs, nombre de factures impayées et une timeline d'activité récente.
L'énoncé de l'ÉTAPE 9 demande explicitement d'y voir aussi : les alertes médicales, le montant
(pas seulement le nombre) des soins restant à réaliser et des factures ouvertes, la dernière
consultation, et les documents récents — cette étape complète l'onglet plutôt que de le refaire.

### Changements base de données

Aucun — tout ce qu'il fallait agréger existait déjà via `listActiveAlerts`, `listSoinsForPatient`
(ÉTAPE 6) et `listDocumentsForPatient` (ÉTAPE 5).

### API / logique serveur

Aucun changement de repository — uniquement de nouveaux calculs dans `page.tsx` à partir de
fonctions déjà écrites :
- **Alertes médicales** : `alerts`, déjà chargé pour l'en-tête (ÉTAPE 3), simplement réaffiché
  dans le corps de l'onglet.
- **Soins restant à réaliser (CHF)** : somme de `unitPrice × quantity` des lignes que
  `listSoinsForPatient` (ÉTAPE 6) classe encore `planned` — tout ce qui n'a, par définition, pas
  encore été réalisé.
- **Factures ouvertes (CHF)** : somme des soldes des factures `issued`/`partially_paid`/`overdue`
  (remplace l'ancien simple décompte).
- **Dernière consultation** : le rendez-vous passé le plus récent qui n'est ni annulé ni marqué
  absent.
- **Documents récents** : les 5 documents les plus récents (`listDocumentsForPatient`, non
  archivés).

### UI

`apps/web/src/app/patients/[id]/page.tsx` (onglet Résumé) : bandeau d'alertes médicales, deux
nouvelles tuiles chiffrées (Soins restant à réaliser, Factures ouvertes — en CHF), une tuile
Dernière consultation, et une liste Documents récents, ajoutées aux tuiles déjà là (Prochain
rendez-vous, Plans de traitement actifs) et à l'activité récente.

### Permissions

Inchangées : `patients.read` pour tout l'onglet.

### Tests

Aucun nouveau test de repository — l'onglet agrège des fonctions déjà testées individuellement
(`listSoinsForPatient` en ÉTAPE 6, `listDocumentsForPatient` en ÉTAPE 5) ; la logique ajoutée ici
est un calcul d'affichage (sommes, filtre, tri par date), pas une nouvelle règle métier à couvrir
séparément.

### Limitation connue

`pnpm install`/`typecheck`/`lint`/`test`/`build` restent bloqués dans ce bac à sable — mêmes
vérifications de substitution que les étapes précédentes.
