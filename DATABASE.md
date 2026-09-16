# DATABASE.md — DentalOS

Décrit le modèle de données initial (`packages/database/prisma/schema.prisma`), les conventions
qui s'y appliquent et les règles d'intégrité. Ce modèle est **fondationnel** : il couvre la
structure attendue par le cahier des charges (section 53) pour ne pas devoir être reconstruit,
mais reste volontairement lean sur les champs — étendre plutôt que réécrire à chaque phase.

## 1. Conventions générales

- **Clés primaires** : `String @id @default(cuid())` partout, sauf tables de jointure pure à clé
  composite (ex. `RolePermission`, `PaymentAllocation` a un id propre car un paiement peut être
  alloué plusieurs fois à la même facture... en pratique on garde un id pour la traçabilité).
- **Argent** : `Decimal @db.Decimal(12, 2)` (jamais `Float`). `Currency` (`CHF` par défaut, `EUR`
  supporté) sur les documents financiers racine uniquement ; les lignes héritent de la devise du
  parent.
- **Horodatage** : `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` sur les
  entités mutables. `createdBy` (id utilisateur, `String?`, sans relation Prisma formelle — voir
  ARCHITECTURE.md §5) sur les entités créées par un acteur humain identifiable.
- **Tenant scoping** : `organizationId` (dénormalisé, indexé) + `clinicId` (relation réelle vers
  `Clinic` quand l'entité est scopée à une clinique) sur toute table métier.
- **Suppression** : aucune entité clinique ou financière n'a de suppression physique en cascade
  incontrôlée. Les relations vers `Patient` depuis les données cliniques/financières utilisent
  `onDelete: Restrict` — on ne peut pas supprimer un patient qui a des factures, paiements, notes
  cliniques, etc. Un vrai workflow d'archivage/anonymisation (RGPD/nLPD) sera conçu en Phase 2/10,
  pas une suppression SQL directe.
- **Nommage** : tables en `snake_case` (`@@map`), colonnes en `camelCase` (défaut Prisma — pas de
  `@map` par champ, compromis de lisibilité/maintenance assumé).
- **Enums** au niveau base de données (Postgres `ENUM`) pour les statuts fermés et stables
  (`InvoiceStatus`, `AppointmentStatus`, ...) plutôt que des `String` libres, pour empêcher les
  valeurs invalides au niveau du schéma, pas seulement de l'application.

## 2. Groupes d'entités

### Tenancy / cœur

`Organization`, `Clinic`, `BankAccount`, `ClinicSetting` (clé/valeur `Json` pour la configuration
libre — évite des dizaines de colonnes nullable), `FeatureFlag`.

### Auth / RBAC / audit

`User`, `Role`, `Permission`, `RolePermission` (jointure), `UserClinicAccess` (association
*utilisateur × clinique × rôle* — un utilisateur peut avoir des rôles différents selon la
clinique), `AuditLog` (append-only, jamais modifié ni supprimé par l'application).

> Pas de tables de session/compte d'authentification pour l'instant — dépend de la décision D1
> (ARCHITECTURE.md §9). Elles seront ajoutées avec le fournisseur choisi en Phase 1.

### Personnes

`Practitioner` (lien optionnel vers `User`, modèle de rémunération dans `CompensationRule`,
séparé du profil car un praticien peut changer de modèle dans le temps), `Employee`.

### Patients

`Patient`, `PatientMedicalProfile` (1:1, **versionné** via `PatientMedicalProfileRevision` — un
changement du profil médical écrit une révision, jamais un écrasement silencieux, conformément à
la section 6 du cahier des charges), `MedicalAlert` (bannière toujours visible, dénormalisée du
profil complet pour un affichage instantané), `Payer` (assurance / tiers / assurance sociale) et
`PatientInsurance` (police liant un patient à un `Payer`).

### Agenda

`Room`, `AppointmentType`, `Appointment`, `WaitingListEntry`.

### Clinique

`ClinicalNote` + `ClinicalNoteRevision` (une note finalisée n'est **jamais** réécrite en place :
toute correction s'ajoute en révision, l'historique complet est conservé — section 7).
`DentalChart` + `DentalChartEntry` (numérotation FDI, snapshot horodaté — consultable à une date
antérieure via `asOfDate`/`isCurrent`). `PeriodontalChart` + `PeriodontalMeasurement` (charting par
dent × site). `TreatmentPlan` → `TreatmentPlanOption` (scénarios "Option A/B/C") →
`TreatmentPlanItem` (postes chiffrés). `Treatment` (acte réellement réalisé, distinct du poste
planifié).

### Devis et moteur tarifaire suisse

`Quote` + `QuoteItem`. `TariffCatalog` → `TariffVersion` → `TariffItem` (+ `TariffRule` pour la
logique de calcul complexe en `Json`) : **aucun tarif n'est codé en dur** dans la logique métier
(section 12) — une nouvelle nomenclature ou une mise à jour de points se traduit par une nouvelle
`TariffVersion`, jamais par une modification de code.

### Facturation

`Invoice` + `InvoiceItem`, `CreditNote` (jamais de modification destructive d'une facture validée —
avoir/correction uniquement, section 13), `Payment` + `PaymentAllocation` (un paiement peut être
réparti sur plusieurs factures, et une facture peut recevoir plusieurs paiements — table de
jointure porteuse de montant, pas de relation directe 1:1), `PaymentReminder` (niveaux de
rappel).

### Recall / communication

`Recall`, `CommunicationTemplate`, `Communication` (historique, tous canaux), `Consent`
(gabarits de consentement versionnés), `Document` (métadonnées ; le contenu binaire vit dans un
`StorageProvider`, pas en base), `Task`, `Notification`.

### Stocks

`Supplier`, `InventoryItem`, `InventoryLot` (traçabilité par lot/péremption), `InventoryMovement`
(réception/consommation/ajustement/transfert — source de vérité du niveau de stock, jamais une
simple colonne `quantity` mutée directement), `PurchaseOrder` + `PurchaseOrderItem` (réception
partielle supportée via `quantityReceived`).

### Finance

`Expense`, `RecurringExpense`, `Laboratory` + `LabCase`, `CompensationRule` (modèle de
rémunération avec date de validité — plusieurs règles dans le temps pour un même praticien),
`CompensationStatement` (décompte mensuel figé avec le détail du calcul, pour audit).

### Analytics / automatisation (structurel)

`Goal`, `AutomationRule`, `WebhookEndpoint` + `WebhookDelivery`. Structure posée en Phase 0 ;
moteur d'exécution réel en Phase 9.

## 3. Intégrité et index (section 54)

- Clés étrangères Prisma pour toute relation métier réelle (voir liste des modèles). `onDelete`
  choisi explicitement à chaque relation (`Cascade` pour les enfants qui n'ont pas de sens sans
  leur parent — ex. lignes de facture ; `Restrict` pour protéger l'historique médical/financier ;
  `SetNull` pour les liens optionnels/informatifs).
- Contraintes `@@unique` : `Clinic(organizationId, slug)`, `Patient(clinicId, patientNumber)`,
  `Practitioner(clinicId, firstName, lastName)`, `Invoice(clinicId, invoiceNumber)`,
  `Quote(clinicId, quoteNumber)`, `CreditNote(clinicId, creditNoteNumber)`,
  `PurchaseOrder(clinicId, orderNumber)`, `InventoryItem(clinicId, sku)`,
  `TariffItem(tariffVersionId, code)`, `Role(organizationId, name)`,
  `UserClinicAccess(userId, clinicId)`, `PatientMedicalProfile(patientId)`.
- Index explicites sur les colonnes de filtrage tenant (`organizationId`, `clinicId`) et sur les
  colonnes de tri/recherche fréquentes : date de rendez-vous, statut de facture, date de paiement,
  nom de patient, échéance de recall/tâche.
- Toute opération multi-tables sensible (émission de facture + mise à jour de solde, allocation de
  paiement, réception de commande + mouvement de stock, ...) doit s'exécuter dans une transaction
  Prisma (`prisma.$transaction`). Ce n'est pas encore câblé en Phase 0 (pas de service métier
  encore écrit) mais c'est une règle non négociable pour toute écriture financière à partir de la
  Phase 5.

## 4. Ce qui n'est délibérément pas modélisé en Phase 0

- Tables d'authentification (dépend de D1).
- Détail fin de l'imagerie/DICOM (section 39) — `Document` suffit pour le lien vers un système
  externe pour l'instant.
- Granularité complète des 6 sites parodontaux par dent normalisés en enum (actuellement
  `PeriodontalMeasurement.site` est une `String` libre — à contraindre par un enum ou une
  validation applicative en Phase 4 quand l'UI du charting parodontal se précise).
- Table d'API keys / webhooks signés en détail (la structure `WebhookEndpoint`/`WebhookDelivery`
  existe, la logique de signature/retry arrive en Phase 9).

## 5. Migrations

`packages/database/prisma/schema.prisma` est la source de vérité. Les migrations SQL versionnées
sont générées par `pnpm db:migrate` (`prisma migrate dev`), jamais écrites à la main. Aucune
migration n'est encore générée dans ce commit (voir `ROADMAP.md` / note d'exécution) — la première
doit être créée dans un environnement ayant accès au registre npm et à une instance Postgres
(`pnpm db:generate && pnpm db:migrate`).
