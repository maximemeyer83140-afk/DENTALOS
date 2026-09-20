# PHASE 9 — Stock & inventaire (ÉTAPE 13)

## Contexte

Suite du développement autonome (Phases 6-8). `Supplier`, `InventoryItem`, `InventoryLot`,
`InventoryMovement`, `PurchaseOrder`/`PurchaseOrderItem` existaient au schéma depuis la Phase 0
sans jamais avoir de repository ni d'UI — un pan entier de la brief (section gestion de stock)
resté à l'état de structure de données. Un cabinet dentaire consomme un vrai stock (gants,
composites, anesthésiants, fraises, champs, ...) et doit voir venir une rupture avant qu'elle
n'arrive plutôt que de la découvrir au moment de traiter un patient — c'est le thème central de ce
module, et une fonctionnalité que ZaWin et DentaGest proposent toutes deux.

`PurchaseOrder`/`PurchaseOrderItem` (bons de commande fournisseur) restent hors scope de cette
phase pour rester sur un livrable cohérent et complet plutôt que deux modules à moitié faits — voir
Limitations connues.

## Changements base de données

Aucune migration de schéma. Aucune nouvelle clé de permission — `inventory.read` et
`inventory.write` existaient déjà depuis la Phase 0 et n'avaient jamais eu d'écran.

## Décision de conception — le solde de stock vient du grand livre, pas des lots

`InventoryLot` enregistre ce qui est physiquement arrivé (numéro de lot, péremption, fournisseur) —
un enregistrement historique, jamais modifié après coup. `InventoryMovement` est le grand livre
append-only qui pilote réellement le solde affiché : `currentStockFor(itemId)` est une simple somme
des quantités *signées* de chaque mouvement (réception positive, consommation négative, ajustement
avec le signe de la correction). Ce choix évite d'avoir à décider, à chaque consommation, de quel
lot elle est "sortie" (FIFO, péremption la plus proche en premier, ...) juste pour répondre à
"combien en reste-t-il" — une vraie simplification, documentée ici parce que ce module suit des
quantités, pas une comptabilisation de valorisation complète par lot (coût moyen pondéré, etc.).

## API / logique serveur

- `packages/database/src/repositories/inventory.ts` (nouveau) :
  - `listSuppliers` / `createSupplier` — `Supplier` appartient à l'organisation, pas à une seule
    clinique (un dépositaire dentaire livre en général plusieurs cabinets d'un même groupe).
  - `listInventoryItems(ctx)` / `getInventoryItem(ctx, itemId)` — chaque article renvoyé porte son
    `currentStock` calculé et un flag `isLowStock` (`currentStock <= reorderThreshold`).
  - `createInventoryItem` / `updateInventoryItem` — vérifie que le fournisseur donné appartient
    bien à l'organisation avant de l'attacher.
  - `receiveStock(ctx, itemId, { quantity, lotNumber?, expiresAt?, supplierId? }, createdBy)` —
    transaction qui crée le lot **et** le mouvement `receipt` ensemble.
  - `consumeStock(ctx, itemId, { quantity, reason?, relatedPatientId?, relatedTreatmentId? },
    createdBy)` — vérifie le solde disponible *avant* d'écrire, lève `InsufficientStockError`
    plutôt que de laisser un solde passer sous zéro.
  - `adjustStock(ctx, itemId, { delta, reason }, createdBy)` — correction signée (inventaire
    physique, casse, péremption jetée), même garde contre un solde négatif si `delta` est négatif.
  - `listMovementsForItem` / `listLotsForItem`.
- Server Actions : `apps/web/src/app/stock/actions.ts` — `createSupplierAction`,
  `createInventoryItemAction`, `receiveStockAction`, `consumeStockAction`, `adjustStockAction`,
  chacune revalidant `/stock` et, pour les mouvements, `/stock/[itemId]`.

## UI

- **`/stock`** : tableau des articles (catégorie, fournisseur, solde, prix d'achat), ligne en ambre
  quand le seuil d'alerte est atteint, création d'article (`CreateItemForm.tsx`) et section
  fournisseurs avec création (`CreateSupplierForm.tsx`).
- **`/stock/[itemId]`** : détail d'un article — tuile de solde actuel (mise en évidence si sous le
  seuil), trois formulaires d'action (`StockMovementForms.tsx` : `ReceiveStockForm`,
  `ConsumeStockForm`, `AdjustStockForm`), liste des lots reçus, historique complet des mouvements
  (type, quantité signée, motif, date).
- **`AppNav`** : lien "Stock" affiché uniquement si `inventory.read`.

## Permissions

Aucune nouvelle clé — `inventory.read` (consultation) et `inventory.write` (créer un article/
fournisseur, réceptionner/consommer/ajuster) réutilisées telles quelles.

## Sécurité / isolation tenant

Garde constante du projet : `InventoryItem` et `Supplier` scopés à `organizationId` (+ `clinicId`
pour les articles, un article de stock étant spécifique à une clinique), toute opération d'écriture
vérifie l'appartenance de l'article/fournisseur avant d'agir, `consumeStock`/`adjustStock`
recalculent le solde disponible dans la même requête avant d'écrire pour ne jamais laisser passer
une opération qui ferait passer le stock sous zéro (protection applicative — une vraie
contention concurrente à très haut volume resterait une amélioration future, comme documenté pour
la numérotation des factures en Phase 5).

## Tests

`inventory.test.ts` — mêmes conventions que toutes les phases précédentes (org + clinique + org
"autre" en fixtures) : création de fournisseur, article à zéro avec seuil zéro marqué "bas",
réception (lot + mouvement + solde), consommation avec refus explicite sous le seuil disponible
(et vérification que le solde n'a pas bougé après un refus), ajustement positif et négatif avec la
même garde, tri des mouvements le plus récent en premier, isolation tenant totale (lecture, fetch,
écriture) sur l'article d'une autre organisation. Vérifiés uniquement via
`node --experimental-strip-types --check` (syntaxe) et le script de bracket-balance pour les
`.tsx`, faute d'accès npm dans cet environnement — limitation constante de la session.

## Limitations connues

- **Pas de bons de commande fournisseur** : `PurchaseOrder`/`PurchaseOrderItem` existent au schéma
  mais restent sans repository/UI — la réception se fait directement sur un article
  (`receiveStock`), sans workflow "commander → attendre → réceptionner en plusieurs fois". Candidat
  naturel pour une prochaine itération, avec `quantityReceived` déjà prévu au schéma pour une
  réception partielle.
- **Pas de traçabilité FIFO par lot** : le solde global est exact, mais DentalOS ne sait pas dire
  "cette consommation est sortie de tel lot" — voir la décision de conception ci-dessus. Suffisant
  pour suivre des quantités, pas pour une valorisation comptable précise par lot.
- **Pas d'alerte proactive** : le seuil bas se voit sur `/stock` (ligne ambre) mais rien ne
  notifie activement — un futur lien avec `Task`/`Communication` (Phase 7) permettrait de générer
  une tâche automatique "recommander X" au franchissement du seuil.
- **Pas de switcher de clinique** : `/stock` liste les articles de la première clinique de
  l'utilisateur, même limitation documentée depuis la Phase 2.

## Definition of Done

- [x] `inventory.ts` repository (fournisseurs, articles, réception/consommation/ajustement,
      lots, mouvements), tenant-scopé, avec tests.
- [x] `/stock` : liste des articles avec alerte de seuil bas, création article/fournisseur.
- [x] `/stock/[itemId]` : détail, lots, historique des mouvements, trois actions de mouvement.
- [x] `AppNav` étendu, lien conditionné à `inventory.read`.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] `pnpm typecheck` / `pnpm test` réels — bloqués par l'absence d'accès npm dans cet
      environnement (limitation constante de la session).
