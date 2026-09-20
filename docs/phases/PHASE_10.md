# PHASE 10 — Bons de commande fournisseur (ÉTAPE 14)

## Contexte

Suite du développement autonome (Phases 6-9). Limitation explicitement notée dans
`docs/phases/PHASE_9.md` : le module Stock permettait de réceptionner du stock (`receiveStock`)
sans jamais avoir tracé ce qui avait été commandé — `PurchaseOrder`/`PurchaseOrderItem` existaient
au schéma depuis la Phase 0 sans repository ni UI. Cette phase ferme cette boucle avec le workflow
"commander → envoyer → réceptionner (en une ou plusieurs livraisons) → clôturer", un thème DentaGest
identifié dès la Phase 6 (suivi des commandes fournisseur).

## Changements base de données

Aucune migration de schéma. Aucune nouvelle clé de permission — le module réutilise
`inventory.read`/`inventory.write` de la Phase 9.

## API / logique serveur

- `packages/database/src/services/purchase-order-number.ts` (nouveau) — `nextPurchaseOrderNumber`,
  même schéma que `nextInvoiceNumber`/`nextQuoteNumber` (`PO-{année}-{séquence}`, calculé dans la
  transaction qui crée la commande).
- `packages/database/src/repositories/purchase-orders.ts` (nouveau) :
  - `createPurchaseOrder(ctx, { supplierId, expectedAt?, items }, createdBy)` — même stratégie de
    retry que `createInvoiceFromQuote` (transaction sérialisable, jusqu'à 3 tentatives sur conflit
    de numérotation concurrente), vérifie que le fournisseur et chaque article appartiennent bien
    au tenant avant de créer quoi que ce soit.
  - `sendPurchaseOrder` (`draft` → `sent`) / `cancelPurchaseOrder` (refuse une commande déjà
    `received`) — même garde `updateMany` + `PurchaseOrderNotEditableError` que
    `InvoiceNotEditableError` en Phase 5.
  - `receivePurchaseOrderItems(ctx, poId, { receipts, lotNumber?, expiresAt? }, createdBy)` — le
    point de jonction avec le Stock (Phase 9) : pour chaque ligne reçue, appelle `receiveStock` (qui
    crée le même lot traçable + mouvement `receipt` qu'une réception manuelle) *et* incrémente
    `PurchaseOrderItem.quantityReceived`, puis recalcule le statut de la commande
    (`partially_received` si au moins une ligne est incomplète, `received` si tout y est). Refuse
    de recevoir plus que ce qu'il reste sur une ligne (`quantityOrdered - quantityReceived`).
- Server Actions : `apps/web/src/app/stock/commandes/actions.ts` —
  `createPurchaseOrderAction`, `sendPurchaseOrderAction`/`cancelPurchaseOrderAction` (actions
  simples sans formulaire, même pattern que `setUserStatusAction`), `receivePurchaseOrderItemsAction`.
- Validation : `apps/web/src/lib/validation/purchase-orders.ts` — même convention que
  `createTreatmentPlanSchema` (Phase 4) : les lignes dynamiques du formulaire de création
  sérialisent en un seul champ `linesJson` plutôt qu'en clés `FormData` indexées.

## UI

- **`/stock/commandes`** : liste des commandes (filtre "En cours"/"Toutes"), création avec lignes
  dynamiques (`CreatePurchaseOrderForm.tsx` — ajouter/retirer une ligne, sélection d'article,
  quantité, prix unitaire).
- **`/stock/commandes/[poId]`** : détail — lignes commandées/reçues/prix, boutons "Envoyer au
  fournisseur" / "Annuler la commande" (`PurchaseOrderActions.tsx`) selon le statut, et
  `ReceiveItemsForm.tsx` pour enregistrer une livraison (quantité par ligne pré-remplie au reste à
  recevoir, plafonnée dessus, avec numéro de lot et péremption optionnels).
- **`/stock`** : lien "Bons de commande →" ajouté à côté du bouton de création d'article.

## Permissions

Aucune nouvelle clé — `inventory.read`/`inventory.write` réutilisées.

## Sécurité / isolation tenant

Garde constante du projet : fournisseur et articles vérifiés appartenir au tenant avant la
création de la commande, `receivePurchaseOrderItems` vérifie que chaque
`purchaseOrderItemId` reçu appartient bien à la commande demandée (et donc au tenant, `getPurchaseOrder`
ayant déjà fait cette vérification), jamais de réception au-delà de ce qui reste dû sur une ligne.

## Tests

`purchase-orders.test.ts` — mêmes conventions (org + clinique + org "autre" en fixtures) :
création avec ses lignes, refus d'un article inconnu, cycle `draft → sent` (refus d'envoyer deux
fois), réception complète en une fois (stock des deux articles vérifié avant/après), réception
partielle puis complétée plus tard (statut `partially_received` puis `received`), refus de
recevoir plus que ce qui reste sur une ligne, annulation d'un brouillon et refus d'annuler une
commande déjà reçue, isolation tenant totale (fetch, liste, écriture) sur la commande d'une autre
organisation. Vérifiés uniquement via `node --experimental-strip-types --check` (syntaxe) et le
script de bracket-balance pour les `.tsx`, faute d'accès npm dans cet environnement — limitation
constante de la session.

## Limitations connues

- **Pas de lien e-mail/PDF vers le fournisseur** : "Envoyer au fournisseur" ne fait que changer le
  statut à `sent` — DentalOS n'envoie rien réellement (même limitation de fond que les Phases 6-8 :
  pas de provider e-mail réel dans cet environnement).
- **Un seul lot par réception, pas par ligne** : `ReceiveItemsForm` applique le même numéro de
  lot/péremption à toutes les lignes reçues dans une même livraison — correct pour une livraison
  groupée d'un même fournisseur à une même date, insuffisant si deux articles de la même livraison
  ont des péremptions différentes (l'utilisateur devrait alors faire deux réceptions séparées).
- **Pas de rapprochement automatique prix commandé/prix facturé** : `unitCost` de la commande et
  `costPrice` de l'article restent deux champs indépendants, aucune alerte si le fournisseur
  facture un prix différent de celui commandé.

## Definition of Done

- [x] `purchase-orders.ts` repository + service de numérotation, tenant-scopés, avec tests.
- [x] `/stock/commandes` : liste, création avec lignes dynamiques.
- [x] `/stock/commandes/[poId]` : détail, envoyer/annuler, réception (complète ou partielle).
- [x] Lien depuis `/stock` vers `/stock/commandes`.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] `pnpm typecheck` / `pnpm test` réels — bloqués par l'absence d'accès npm dans cet
      environnement (limitation constante de la session).
