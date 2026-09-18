# PHASE 5 — Facturation

## Objectifs

Moteur de facturation (facture validée = immuable), paiements avec allocation multi-factures,
avoirs, et la génération du **payload** QR-facture suisse conforme (pas un simple QR visuel —
section 14 du cahier des charges). Le rendu de l'image QR elle-même (bibliothèque `qrcode`) attend
l'accès npm — cette phase livre la structure de données correcte, l'étape mécanique de rendu vient
ensuite.

## Changements base de données

Aucun nouveau modèle : `Invoice`, `InvoiceItem`, `CreditNote`, `Payment`, `PaymentAllocation`,
`BankAccount` existent depuis la Phase 0. Un compte bancaire de test (IBAN suisse canonique
`CH93 0076 2011 6238 5295 7`, utilisé dans toute la documentation SIX) est ajouté au seed de
développement pour que le service QR-facture ait une donnée réelle à consommer.

## ⚠️ Avertissement explicite — QR-facture

`services/swiss-qr-bill.ts` reconstruit de mémoire la structure du payload définie par les
"Swiss Implementation Guidelines QR-bill" (SIX) : ordre des ~31 champs, calcul du chiffre de
contrôle de la référence QRR (Modulo 10 récursif). C'est une reconstruction faite sans accès
réseau pour vérifier le document officiel field-by-field. **Avant tout envoi réel à une banque ou
tout affichage à un patient** : valider chaque ligne du payload généré contre le document officiel
SIX en vigueur, et tester avec l'outil de validation d'une banque/PostFinance. Ne jamais présenter
cette implémentation comme certifiée. Point déjà présent dans `COMPLIANCE.md`, réaffirmé ici parce
que c'est le code qui l'implémente.

## Addendum 1 — moteur tarifaire suisse (ajouté après retour utilisateur)

Le premier passage de cette phase construisait les devis/factures avec une description et un prix
saisis à la main (`TreatmentPlanForm`) — une violation directe de la règle "jamais de tarif codé en
dur" (section 79) que cet addendum corrige : le plan de traitement se construit maintenant en
ajoutant des lignes choisies dans un vrai catalogue tarifaire, plusieurs lignes par option (ex. une
séance = anesthésie + digue + obturation composite, chacune sa propre ligne), avec un prix que le
serveur seul calcule et qu'aucun formulaire ne peut modifier.

- `packages/database/src/repositories/tariff.ts` — `listActiveTariffItems`,
  `getTariffItem` : lisent la version *active* du catalogue de l'organisation (`TariffCatalog` →
  `TariffVersion.isActive` → `TariffItem`, tous existants depuis la Phase 0).
- `packages/database/src/services/tariff-pricing.ts` — `computeTariffItemPrice` : seul endroit
  qui calcule le prix CHF d'une position, exactement comme le tarif dentaire suisse fonctionne
  réellement (points × valeur du point, sauf position à prix forfaitaire) — jamais un prix
  recopié depuis le client.
- `TreatmentPlanForm.tsx` a été entièrement réécrit : composant client avec des lignes dynamiques
  ("+ Ajouter une ligne"), chaque ligne choisit un acte dans un `<select>` groupé par catégorie,
  dent, quantité ; un total s'affiche en direct côté client **à titre indicatif seulement** — le
  serveur (`createTreatmentPlanAction`) ignore tout prix venu du formulaire et ré-appelle
  `computeTariffItemPrice` lui-même pour chaque ligne avant d'écrire quoi que ce soit.

Au moment de cet addendum, le catalogue seedé (`seed-tariff-catalog.ts`) utilisait des codes
mnémoniques d'exemple (`ANE-01`, `RESTO-02`...) — **pas** des codes SSO/DENTOTAR officiels : le
vrai catalogue est un produit sous licence de la SSO, et cette session avait explicitement tenté de
le récupérer via `WebFetch` sur sso.ch et plusieurs miroirs, bloqué à chaque tentative
(`EGRESS_BLOCKED`, politique réseau du bac à sable). Voir l'addendum 2 ci-dessous : ce catalogue de
démonstration a depuis été remplacé par le vrai catalogue officiel, fourni directement par le
cabinet.

## Addendum 2 — remplacement par le vrai catalogue officiel SSO + Devis/Traitement (ajouté après
retour utilisateur : "voici les tarifs complets")

Le cabinet a fourni le fichier texte de l'export hors-ligne officiel du **Tarif 222 "Tarif dentaire
AA/AM/AI (SSO)"**, version V2.00 / 1er janvier 2025 (en vigueur depuis le 1er janvier 2018, état du
catalogue au 18 décembre 2024). Le document lui-même autorise cet usage : *"Les fournisseurs de
prestations (à savoir les membres de la SSO et les signataires individuels de la convention
tarifaire) sont autorisés à facturer sur cette base aux assureurs sociaux les prestations fournies
aux assurés AA/AM/AI."* — c'est exactement l'usage fait ici : le logiciel de facturation du cabinet
qui l'a fourni.

- **Extraction** : le fichier source (texte issu d'un navigateur tarifaire hors ligne) a été analysé
  par un script Python dédié (non versionné dans le dépôt, exécuté une fois pendant cette session)
  qui isole chaque position (code, titre, chapitre, points AA/AM/AI, plage de points patient privé,
  taux de TVA, prise en charge). Deux pièges rencontrés et corrigés pendant l'extraction : (1) les
  codes "Prestations groupées Plus" (LP+, ex. `4.0000.LP`) apparaissent deux fois dans le document —
  une mention brève sans données dans leur chapitre d'origine, puis leur définition complète au
  chapitre 15 — un mauvais choix aurait gardé la version vide ; corrigé en fusionnant par code et en
  gardant la variante la plus complète. (2) des titres longs s'étalent sur 2-3 lignes dans le texte
  source ; le script recolle ces lignes de continuation plutôt que de tronquer le titre au premier
  saut de ligne. **630 positions** au total (chapitres 01 à 12 : actes cliniques ; 15 : prestations
  groupées Plus ; 19-20 : matériel/positions cluster à prix libre), chacune avec au moins un champ
  de prix exploitable — vérifié pendant la génération, pas supposé.
- **Schéma** : `TariffItem` gagne `pointsPrivateMin`/`pointsPrivateMax` (Decimal, nullable) — le
  tarif suisse fixe un nombre de points pour l'AA/AM/AI mais une *plage* de points pour DENTOTAR
  (patient privé), le praticien choisissant dans cette plage selon la complexité du cas. `points`
  reste le nombre de points AA/AM/AI (ou AA/AM pour une position LP+).
- **`tariff-pricing.ts` redesigné** : `computeTariffItemPrice` prend maintenant `{ item, regime,
  pointValue, privatePoints? }` — le régime (`"AAI"` ou `"PRIVATE"`) et la valeur du point ne sont
  **jamais** lus sur l'item lui-même mais fournis par l'appelant à chaque calcul (réglage de
  cabinet/séance, jamais codé en dur). `privatePoints` (optionnel) choisit un nombre de points dans
  la plage privée ; par défaut le maximum de la plage.
- **Devis / Traitement** : `TreatmentPlanItemInput` gagne un `status` optionnel ; `createTreatmentPlan`
  le propage tel quel (défaut Prisma `planned` si omis). `createTreatmentPlanAction` gagne un champ
  `mode` (`"quote"` | `"treatment"`) soumis par le bouton cliqué (deux boutons submit, même
  `name="mode"`, valeurs différentes — comportement natif du formulaire, pas de JS supplémentaire) :
  `"quote"` construit une option avec des lignes `planned` (un devis, comme avant) ; `"treatment"`
  construit la même structure mais avec des lignes `completed` (un acte réalisé aujourd'hui). Choix
  délibéré de réutiliser `TreatmentPlan`/`TreatmentPlanOption`/`TreatmentPlanItem` plutôt que de
  câbler une pipeline séparée sur le modèle `Treatment` (qui existe dans le schéma depuis la Phase 0
  mais n'a pas de repository) : la distinction "proposé" vs "réalisé" est exactement ce que le champ
  `status` existant sert à représenter, et une option "Traitement" reste éligible au même parcours
  `createQuoteFromPlanOption` → facture si le cabinet veut la facturer après coup.
- **`TreatmentPlanForm.tsx` réécrit une seconde fois** : recherche texte-libre ("tape un mot,
  Entrée pour ajouter" — filtre en direct sur 630 positions, tri par pertinence : titre commence
  par > mot commence par > code > sous-chaîne), sélecteur de régime tarifaire + champ "valeur du
  point" éditable (avertissement du plafond SSO CHF 1.70 affiché en régime privé), menu "codes
  groupés" (`apps/web/src/lib/tariff-presets.ts` — protocoles courants du type "Composite 2 faces
  (molaire)" ajoutant anesthésie + digue + mordançage + adhésif + obturation en un clic, codes réels
  vérifiés présents dans le catalogue, pas inventés), bouton retirer par ligne, deux boutons submit
  DEVIS/TRAITEMENT, bouton Imprimer (`window.print()` + CSS `@media print` isolant le tableau de
  lignes). Le total affiché en direct reste une prévisualisation client — recalculé indépendamment
  côté serveur avant toute écriture.

### ⚠️ Avertissement explicite — ce qui reste à vérifier avant usage réel

Le catalogue est maintenant le vrai Tarif 222, pas un exemple inventé — mais l'extraction automatisée
d'un document texte de 13 000+ lignes peut avoir des erreurs résiduelles au-delà de ce qui a été
vérifié pendant cette session (troncatures de titres corrigées, décompte : 630/630 positions avec un
champ de prix ; voir ci-dessus). Avant toute facturation réelle : faire vérifier par le cabinet un
échantillon des positions les plus utilisées contre le document officiel, en particulier les points
AA/AM/AI et les plages privées min/max. Le "codes groupés" (`tariff-presets.ts`) sont une commodité
d'interface, pas des positions officielles — vérifier que les protocoles proposés correspondent aux
habitudes cliniques réelles du cabinet avant de s'y fier en routine.

## Décisions prises dans cette phase

- **Numérotation facture** : assignée **à la création du brouillon**, pas seulement à la
  validation — même pattern de transaction `Serializable` que les patients/devis. Limite assumée :
  un brouillon annulé laisse un trou dans la séquence. Une séquence strictement sans trou
  nécessiterait de numéroter seulement à la validation, ce qui demanderait de rendre
  `Invoice.invoiceNumber` optionnel dans le schéma — pas fait ici, à reconsidérer si un audit
  comptable l'exige.
- **Immutabilité** : `addInvoiceItem` refuse toute écriture si `status !== "draft"`. Après
  `validateInvoice`, la facture ne peut plus être modifiée — seul un avoir peut corriger le
  montant dû (section 13).
- **Facture créée depuis un devis accepté** : `createInvoiceFromQuote` copie les lignes d'un devis
  dans une nouvelle facture brouillon. Pas de facturation "libre" dans cette phase (formulaire de
  saisie manuelle de lignes — Phase 8+ UI).
- **Allocation de paiement** : un paiement peut être réparti sur plusieurs factures
  (`PaymentAllocation`), mais l'UI de cette phase ne couvre que le cas simple (un paiement → une
  facture) ; le repository, lui, supporte déjà le cas général.

## API / logique serveur

- `packages/database/src/services/invoice-calculator.ts` — seul endroit autorisé à calculer
  `subtotal`/`taxTotal`/`total`/`balance` (section 79).
- `packages/database/src/services/invoice-number.ts` — numérotation concurrente-sûre.
- `packages/database/src/services/swiss-qr-bill.ts` — `computeMod10CheckDigit`,
  `buildQrrReference`, `verifyQrrReference`, `buildSwissQrBillPayload`.
- `packages/database/src/repositories/invoices.ts` — `createInvoiceFromQuote`, `validateInvoice`,
  `getInvoice`, `listInvoicesForPatient`.
- `packages/database/src/repositories/payments.ts` — `recordPayment` (transaction : crée le
  paiement, les allocations, et remet à jour `amountPaid`/`balance`/`status` de chaque facture
  touchée — jamais un simple `UPDATE` isolé qui pourrait désynchroniser les deux).
- `packages/database/src/repositories/credit-notes.ts` — `createCreditNote` (refuse sur une
  facture `draft` ou déjà `cancelled`), numéroté, réduit le solde dû.
- `packages/database/src/repositories/tariff.ts` / `services/tariff-pricing.ts` — voir addendum
  ci-dessus.

## UI

- Onglet **Facturation** sur `/patients/[id]` : liste des factures, bouton "Valider" sur un
  brouillon, formulaire simple d'enregistrement de paiement par facture. Bouton "Facturer" sur un
  devis accepté (onglet Clinique).

## Permissions

`invoices.read`, `invoices.create`, `invoices.validate`, `payments.create` (déjà présentes depuis
la Phase 0).

## Sécurité

- Une facture `issued`/`paid`/`partially_paid` n'est jamais modifiable par `addInvoiceItem` —
  vérifié dans la fonction elle-même, pas seulement côté UI.
- Toute opération financière multi-tables (paiement + allocations + mise à jour de solde) tourne
  dans une transaction Postgres.

## Tests

- `invoice-calculator.test.ts` : total = somme des lignes ; solde = total − encaissé ; arrondi au
  centime ; jamais de solde négatif en cas de trop-perçu.
- `invoices.test.ts` : une facture validée refuse `addInvoiceItem` et une double validation ;
  numérotation unique sous création concurrente ; recalcul des totaux à l'ajout d'une ligne.
- `payments.test.ts` : un paiement partiel passe la facture en `partially_paid` ; un paiement qui
  couvre le solde la passe en `paid` (y compris en deux versements) ; répartition d'un paiement sur
  deux factures met à jour les deux soldes correctement ; rejet si les allocations ne totalisent pas
  le montant payé ou dépassent le solde d'une facture.
- `credit-notes.test.ts` : refus d'un avoir sur une facture `draft` ; un avoir couvrant tout le
  solde passe la facture en `credited` ; refus d'un avoir supérieur au solde restant dû.
- `swiss-qr-bill.test.ts` : le chiffre de contrôle Modulo 10 récursif est déterministe et
  auto-cohérent (`buildQrrReference` produit toujours une référence que `verifyQrrReference`
  valide ; une référence corrompue est détectée) ; le payload contient les champs obligatoires
  dans l'ordre attendu, avec fins de ligne CRLF et trailer `EPD`.
- `tariff-pricing.test.ts` : priorité au prix forfaitaire quand il existe ; régime AAI multiplie les
  points fixes par la valeur du point donnée ; régime PRIVATE utilise le maximum de la plage privée
  par défaut ou un nombre de points choisi dans cette plage, rejette un choix hors plage, retombe
  sur les points fixes quand aucune plage privée n'existe (positions LP+) ; erreur si rien n'est
  disponible ; arrondi au centime.
- `tariff.test.ts` : seule la version active du catalogue est listée ; une position d'une version
  inactive reste lisible par id (historique jamais supprimé) ; isolation multi-tenant vérifiée.

## Definition of Done

- [x] Services et repositories écrits (calculateur, numérotation, factures, paiements, avoirs,
      QR-facture)
- [x] Onglet Facturation branché
- [x] Moteur tarifaire (catalogue/version/positions) branché au plan de traitement — devis
      multi-lignes construits depuis le catalogue, jamais un prix saisi à la main
- [x] Catalogue de démonstration remplacé par le vrai Tarif 222 SSO (AA/AM/AI), fourni par le
      cabinet — 630 positions, régimes AA/AM/AI et patient privé, valeur du point ajustable,
      boutons Devis/Traitement, codes groupés, impression (addendum 2)
- [x] Tests d'immutabilité, de numérotation concurrente, d'allocation de paiement, du chiffre de
      contrôle QRR et du calcul tarifaire (régimes AAI/PRIVATE) écrits
- [ ] `pnpm install && pnpm db:migrate && pnpm test` exécutés avec succès — **toujours bloqué**
      (même limitation réseau que les phases précédentes)
- [ ] Payload QR-facture validé contre le document officiel SIX et un outil bancaire réel — **non
      fait, bloquant avant tout usage réel** (voir avertissement ci-dessus)
- [ ] Échantillon du catalogue Tarif 222 vérifié par le cabinet contre le document officiel — **non
      fait, recommandé avant toute facturation réelle** (voir avertissement de l'addendum 2)
