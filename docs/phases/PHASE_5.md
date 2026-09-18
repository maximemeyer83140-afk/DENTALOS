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

## Addendum — moteur tarifaire suisse (ajouté après retour utilisateur)

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

### ⚠️ Avertissement explicite — codes du catalogue de démonstration

Les positions seedées dans `packages/database/src/seed-tariff-catalog.ts` (`ANE-01`, `RESTO-02`,
etc.) **ne sont pas des codes SSO/DENTOTAR officiels**. Le vrai catalogue DENTOTAR® (~500
positions, tarif dentaire suisse utilisé pour les patients privés et, sur la même structure par
points, pour AA/AM/AI) est un produit sous licence de la SSO. Cette session a explicitement tenté
de le récupérer via `WebFetch` sur sso.ch et plusieurs sites miroirs hébergeant le PDF officiel —
chaque tentative a été bloquée par la politique réseau du bac à sable (`EGRESS_BLOCKED`, pas une
supposition). Le seed utilise donc des codes mnémoniques (jamais un numéro à 4 chiffres qui
pourrait passer pour un vrai code SSO) et des points d'exemple, à l'exception d'un seul chiffre
vérifié contre une source en ligne : la valeur du point AA/AM/AI est fixée nationalement à
**CHF 1.00** depuis le 1er janvier 2018 (confirmé par recherche web, pas inventé). Avant tout usage
réel : remplacer le contenu de `seed-tariff-catalog.ts` par l'export officiel DENTOTAR que la SSO
fournit à ses cabinets membres — le modèle `TariffCatalog`/`TariffVersion` supporte déjà de faire
cohabiter plusieurs versions et de basculer la version active sans changement de code ; un
importeur CSV/Excel pour ce fichier serait un ajout mécanique une fois le fichier en main.

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
- `tariff-pricing.test.ts` : priorité au prix forfaitaire quand il existe ; sinon points × valeur
  du point ; erreur si ni l'un ni l'autre n'est disponible ; arrondi au centime.
- `tariff.test.ts` : seule la version active du catalogue est listée ; une position d'une version
  inactive reste lisible par id (historique jamais supprimé) ; isolation multi-tenant vérifiée.

## Definition of Done

- [x] Services et repositories écrits (calculateur, numérotation, factures, paiements, avoirs,
      QR-facture)
- [x] Onglet Facturation branché
- [x] Moteur tarifaire (catalogue/version/positions) branché au plan de traitement — devis
      multi-lignes construits depuis le catalogue, jamais un prix saisi à la main
- [x] Tests d'immutabilité, de numérotation concurrente, d'allocation de paiement, du chiffre de
      contrôle QRR et du calcul tarifaire écrits
- [ ] `pnpm install && pnpm db:migrate && pnpm test` exécutés avec succès — **toujours bloqué**
      (même limitation réseau que les phases précédentes)
- [ ] Payload QR-facture validé contre le document officiel SIX et un outil bancaire réel — **non
      fait, bloquant avant tout usage réel** (voir avertissement ci-dessus)
- [ ] Catalogue de démonstration remplacé par l'export DENTOTAR officiel de la SSO — **non fait,
      bloquant avant toute facturation réelle** (voir avertissement ci-dessus)
