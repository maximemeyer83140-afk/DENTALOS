# PHASE 14 — Rémunération des praticiens (ÉTAPE 18)

## Contexte

Demande explicite de l'utilisateur : "en tant qu'administrateur, pouvoir mettre le % de
rétrocession, voir le CA". `CompensationRule`/`CompensationStatement` existaient au schéma depuis
la Phase 0 sans repository ni UI. C'est un besoin réel et fréquent des cabinets suisses à
plusieurs praticiens associés : chacun est rémunéré selon un pourcentage de rétrocession
(souvent sur le chiffre d'affaires facturé ou encaissé) plutôt qu'un salaire fixe, et ce taux doit
pouvoir changer dans le temps sans perdre la trace de ce qui a été appliqué par le passé.

## Décisions de conception

**Historique de taux jamais réécrit.** `setCompensationRule` ne modifie jamais une règle
existante : fixer un nouveau taux ferme la règle actuellement ouverte (`validTo` prend la date de
prise d'effet du nouveau taux) et en crée une nouvelle. Un décompte généré des mois plus tard
reste explicable : "ce décompte de mars a utilisé 40%, celui de juillet 45%". Une garde explicite
refuse de faire démarrer un nouveau taux *avant* le début du taux actuellement ouvert — accepter ça
créerait un intervalle incohérent (`validTo` antérieur à son propre `validFrom`) et corromprait
l'historique.

**Cinq modèles de rémunération**, choisis par le champ `CompensationModel` déjà présent au schéma :
- `salary` — montant fixe, indépendant du CA.
- `percentage_production` — % de la valeur des actes réalisés (`Treatment`, qu'ils soient facturés
  ou non — le "produit" du praticien).
- `percentage_collected` — % de ce qui a été réellement encaissé (`PaymentAllocation`).
- `percentage_revenue` — % du facturé net (`Invoice.total` moins les avoirs émis).
- `hybrid` — montant fixe garanti + % sur le facturé net qui dépasse un seuil.

Les deux derniers (`fixedAmount`, `thresholdAmount`) vivent dans `CompensationRule.config` (`Json`,
déjà réservé à cet effet en Phase 0) plutôt que dans de nouvelles colonnes — deux nombres
optionnels ne justifient pas une migration.

**Le taux appliqué est celui en vigueur au début de la période.** Générer un décompte ne
pro-rate jamais un changement de taux survenu en cours de période — documenté comme une
simplification délibérée (voir Limitations connues).

**`CompensationStatement` (décompte) suit le même cycle de vie que les factures** :
`draft → validated → paid`, chaque transition gardée (`CompensationStatementNotEditableError`),
un ajustement manuel n'est possible qu'en `draft`.

## Changements base de données

Aucune migration de schéma. Deux nouvelles clés de permission :
`compensation.read`, `compensation.write` (catégorie `compensation`).

## API / logique serveur

- `packages/database/src/repositories/compensation.ts` (nouveau) :
  - `setCompensationRule` / `listCompensationRules` / `getActiveCompensationRule` — voir décisions
    ci-dessus.
  - `computeCaBreakdown` (exporté) — agrège production/facturé/encaissé/avoirs pour un praticien
    sur une période ; utilisé aussi bien en aperçu (page d'ensemble, sans créer de décompte) que
    dans `generateCompensationStatement`.
  - `applyCompensationModel` — fonction pure qui applique un modèle à un `CaBreakdown` ; testée
    indépendamment de toute base de données pour chacun des cinq modèles.
  - `generateCompensationStatement` — calcule le CA réel de la période, applique la règle active,
    crée le décompte en `draft`. Refuse explicitement si aucune règle n'est active à la date de
    début de période.
  - `setStatementAdjustment` / `validateStatement` / `markStatementPaid`.
- Server Actions : `apps/web/src/app/remuneration/actions.ts` — le formulaire de taux saisit un
  pourcentage humain (0-100), converti en fraction (÷100) avant stockage, même convention que
  `quotes.acceptanceRate` dans `services/analytics.ts` (Phase 7).

## UI

- **`/remuneration`** : vue d'ensemble — un praticien par ligne, modèle et taux actifs, CA du mois
  en cours (production/facturé/encaissé) calculé en aperçu sans générer de décompte.
- **`/remuneration/[practitionerId]`** :
  - `SetRuleForm.tsx` — formulaire qui n'affiche que les champs pertinents selon le modèle choisi
    (le taux se cache pour "Salaire fixe", le seuil n'apparaît que pour "Fixe + %"), avec une
    description en clair du calcul sous le formulaire.
  - Historique des taux (toutes les règles, dates de validité).
  - `GenerateStatementForm.tsx` — génère un décompte sur une période choisie.
  - `StatementRow.tsx` — repliée par défaut (montant final visible d'un coup d'œil), dépliable pour
    voir le détail du calcul (production/facturé/encaissé/avoirs → base retenue × taux = montant),
    ajustement manuel en `draft`, boutons Valider/Marquer payé selon le statut.
- **`AppNav`** : lien "Rémunération" affiché si `compensation.read`.

## Permissions

`compensation.read` (vue d'ensemble, décompte, historique), `compensation.write` (fixer un taux,
générer/ajuster/valider/payer un décompte).

## Sécurité / isolation tenant

Garde constante du projet : `setCompensationRule`/`generateCompensationStatement` vérifient que le
praticien appartient au tenant avant toute écriture ; `setStatementAdjustment`/
`validateStatement`/`markStatementPaid` scopent systématiquement par `organizationId`+`clinicId`.
Les montants de rémunération sont des données sensibles : ce module est entièrement gardé par
`compensation.read`/`compensation.write`, jamais visible par défaut (seul un rôle qui les détient
explicitement y accède — voir Limitations pour l'absence de vue "mon propre décompte" côté
praticien).

## Tests

`compensation.test.ts` — deux blocs :
- `applyCompensationModel` : les cinq modèles vérifiés contre des CA connus, y compris le cas
  `hybrid` sous le seuil (excédent jamais négatif).
- Le repository complet : taux initial, changement de taux qui ferme l'ancien sans le modifier,
  refus explicite d'antidater un nouveau taux, refus d'un modèle à taux sans taux fourni, génération
  d'un décompte à partir de vraies factures/paiements/avoirs créés en fixture (billed/collected/
  creditNotes/baseAmount/computedAmount vérifiés un à un), refus de générer sans règle active,
  ajustement en brouillon puis refus une fois validé, cycle `draft → validated → paid` gardé,
  isolation tenant totale. Vérifiés uniquement via `node --experimental-strip-types --check`
  (syntaxe) et le script de bracket-balance pour les `.tsx`, faute d'accès npm dans cet
  environnement — limitation constante de la session.

## Limitations connues

- **Pas de pro-rata sur un changement de taux en cours de période** : générer un décompte du 1er
  au 31 janvier avec un taux qui a changé le 15 applique le taux du 1er janvier à toute la
  période — documenté, pas caché. Un cabinet avec ce besoin devrait générer deux décomptes
  (1er-14, 15-31).
- **Pas de vue "mon décompte" côté praticien** : le module est entièrement administrateur —
  un praticien ne peut pas consulter ses propres décomptes sans qu'un admin lui montre l'écran ;
  une extension naturelle serait une permission plus fine limitée à ses propres
  `CompensationStatement`.
- **Pas d'export PDF/comptable du décompte** : le décompte existe en base et à l'écran, jamais
  encore sous une forme imprimable à remettre au praticien.
- **`percentage_collected` ignore les avoirs** : un encaissement suivi d'un remboursement via avoir
  reste compté comme encaissé tel quel — cohérent avec le principe "chaque registre reste
  indépendant" déjà appliqué ailleurs (Phase 10 : coût commande vs coût article), mais à garder en
  tête pour un cabinet qui rembourse fréquemment.

## Definition of Done

- [x] `compensation.ts` repository (règles versionnées, calcul de CA, cinq modèles, décomptes),
      tenant-scopé, avec tests couvrant la logique pure et l'intégration complète.
- [x] `/remuneration` : vue d'ensemble par praticien (taux actif + CA du mois).
- [x] `/remuneration/[practitionerId]` : historique des taux, nouveau taux, génération/ajustement/
      validation/paiement des décomptes.
- [x] `AppNav` étendu, lien conditionné à `compensation.read`.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] `pnpm typecheck` / `pnpm test` réels — bloqués par l'absence d'accès npm dans cet
      environnement (limitation constante de la session).
