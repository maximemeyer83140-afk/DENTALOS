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

## Definition of Done

- [x] Services et repositories écrits (calculateur, numérotation, factures, paiements, avoirs,
      QR-facture)
- [x] Onglet Facturation branché
- [x] Tests d'immutabilité, de numérotation concurrente, d'allocation de paiement et du chiffre de
      contrôle QRR écrits
- [ ] `pnpm install && pnpm db:migrate && pnpm test` exécutés avec succès — **toujours bloqué**
      (même limitation réseau que les phases précédentes)
- [ ] Payload QR-facture validé contre le document officiel SIX et un outil bancaire réel — **non
      fait, bloquant avant tout usage réel** (voir avertissement ci-dessus)
