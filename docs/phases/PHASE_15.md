# PHASE 15 — Odontogramme visuel & sélecteur de dent (ÉTAPE 19)

## Contexte

Demande explicite de l'utilisateur : dans la section "Plan de traitement", remplacer la saisie
d'un numéro de dent au clavier par une interface avec de vraies images de dents et un code couleur
selon leur état, "plus complète et intuitive". L'odontogramme lui-même (onglet Clinique) avait le
même défaut de fond : une grille de cases numérotées cliquables, sans représentation visuelle de la
dent, ne couvrant que 5 des 15 états cliniques possibles (`caries`, `composite`, `crown`,
`implant`, `missing` — les 10 autres, `amalgam`, `bridge`, `planned_extraction`, `endodontics`,
`lesion`, `veneer`, `inlay`, `onlay`, `provisional`, restaient invisibles), et son interaction
("clique pour faire avancer un cycle de 6 états fixes") n'aurait de toute façon pas pu couvrir les
15 sans un nombre de clics ingérable.

## Décisions de conception

**Une palette unique, un seul endroit.** `apps/web/src/lib/dental-conditions.ts` devient la source
de vérité pour les 15 états (`CONDITION_STYLE` : libellé, couleur de remplissage/contour SVG,
classe de pastille) — l'odontogramme et le nouveau sélecteur de dent du plan de traitement y
puisent tous les deux, pour ne jamais afficher deux couleurs différentes pour la même "carie"
selon l'écran.

**De vraies silhouettes de dent, pas des images externes.** `components/dental/ToothIcon.tsx`
dessine chaque dent en SVG inline (deux variantes : `anterior` — incisives/canines, couronne
étroite, une racine ; `posterior` — prémolaires/molaires, couronne large, racine double) plutôt que
d'introduire un pipeline d'assets image. Ce n'est pas anatomiquement exact, mais reconnaissable
comme une dent (couronne + racine) au lieu d'une case numérotée — et se colore, s'anime et
s'affiche instantanément sans requête réseau ni fichier binaire dans le dépôt.

**Sélection par menu, jamais par cycle.** L'ancien odontogramme faisait avancer l'état d'un cran à
chaque clic ; avec 15 états, ce serait jusqu'à 14 clics pour atteindre le bon. Cliquer une dent
ouvre maintenant une popover listant les 15 états (pastille couleur + libellé), un seul clic
choisit directement le bon.

**Le même sélecteur visuel remplace la saisie manuelle du numéro de dent.** Le nouveau
`components/dental/ToothPickerField.tsx` (bouton + mini-arche dans une popover) remplace le
`<input type="number" min={11} max={48}>` du plan de traitement — reconnaître une dent par sa
position dans l'arcade est plus rapide que se souvenir de son code FDI. Quand l'odontogramme du
patient existe déjà, chaque dent du sélecteur est colorée selon son état réel (une dent rouge dans
le sélecteur signale déjà "carie ici" pendant qu'on choisit où traiter) — sans deuxième vérification
dans un autre onglet.

## Changements base de données

Aucun — uniquement une refonte d'interface, le modèle `DentalChartEntry`/`DentalConditionType`
existait déjà et n'est pas modifié.

## Fichiers

- `apps/web/src/lib/dental-conditions.ts` (nouveau) — palette des 15 états, ordre d'affichage,
  listes de dents par quadrant (`UPPER_RIGHT`/`UPPER_LEFT`/`LOWER_RIGHT`/`LOWER_LEFT`), détection
  du type de dent (`toothVariant`) à partir du numéro FDI.
- `apps/web/src/components/dental/ToothIcon.tsx` (nouveau) — silhouette SVG colorable.
- `apps/web/src/components/dental/ToothPickerField.tsx` (nouveau) — sélecteur de dent réutilisable
  (bouton + popover mini-arche), coloré par les conditions actuelles si fournies.
- `apps/web/src/app/patients/[id]/Odontogram.tsx` (réécrit) — quadrants séparés par une ligne
  médiane (haut/bas, droite/gauche, comme un vrai schéma dentaire), dents en `ToothIcon`, popover
  de sélection au clic, légende des 15 états toujours visible sous le schéma.
- `apps/web/src/app/patients/[id]/TreatmentPlanForm.tsx` — la colonne "Dent" de chaque ligne
  utilise `ToothPickerField` au lieu d'un champ numérique ; le rendu imprimable (`tp-print-only`)
  reste inchangé (texte simple, pas de widget interactif sur le PDF/impression).
- `apps/web/src/app/patients/[id]/page.tsx` — l'onglet "Plan de traitement" charge désormais aussi
  `getCurrentChart` (même appel déjà fait par l'onglet "Clinique") pour colorer le sélecteur de
  dent avec l'état réel de chaque dent du patient.

## UI / UX

- Odontogramme : 32 dents en 4 quadrants visuellement séparés, icône colorée + numéro FDI, clic →
  popover de 15 choix (pastille + libellé), légende permanente sous le schéma expliquant chaque
  couleur — plus besoin de deviner ce que signifie une couleur.
- Plan de traitement : bouton "Dent 26" / "Choisir…" à la place d'un champ numérique nu ; la
  popover reproduit la même disposition en arche que l'odontogramme, colorée par l'état réel du
  patient, avec un bouton "Effacer" pour revenir à "aucune dent précisée".

## Permissions

Aucune — pure refonte d'UI sur des actions déjà gardées (`recordToothConditionAction` reste
protégée par `clinical.write`, inchangé).

## Sécurité

Aucun changement de surface : les mêmes Server Actions gardées qu'avant (`recordToothConditionAction`,
`createTreatmentPlanAction`) reçoivent les mêmes données (`toothNumber`), seule la façon de les
saisir côté client change.

## Tests

Aucun nouveau test — changement purement présentationnel côté client (SVG, popovers), sans nouvelle
logique serveur à couvrir ; le comportement des Server Actions sous-jacentes reste couvert par les
tests existants des phases précédentes (Phase 4). Vérifié via le script de bracket-balance sur
tous les fichiers `.tsx` touchés/créés et `node --experimental-strip-types --check` pour le
fichier `.ts`, faute d'accès npm dans cet environnement — limitation constante de la session.

## Limitations connues

- **Silhouettes stylisées, pas anatomiquement précises** : suffisant pour distinguer dent
  antérieure/postérieure au coup d'œil, pas un schéma dentaire de qualité clinique/légale.
- **Même orientation pour l'arcade supérieure et inférieure** : une vraie planche dentaire dessine
  parfois les racines des dents du haut vers le haut et celles du bas vers le bas (miroir) ; ici
  toutes les dents gardent la même orientation (couronne en haut) — la position dans la grille
  (rangée du haut/du bas) suffit à distinguer les arcades sans ce détail, simplification
  délibérée pour rester simple et fiable à produire sans prévisualisation visuelle possible dans
  cet environnement.
- **Popover fermée au clic extérieur via un calque plein écran** : fonctionne partout mais n'est
  pas fermée par la touche Échap — amélioration mineure possible plus tard.

## Definition of Done

- [x] Palette unique des 15 états dentaires (`lib/dental-conditions.ts`).
- [x] Icône de dent SVG réutilisable, colorée par état.
- [x] Odontogramme reconstruit : icônes de dents, popover de sélection, légende, disposition en
      quadrants.
- [x] Sélecteur de dent visuel réutilisable, branché dans le plan de traitement, coloré par l'état
      réel du patient.
- [x] Vérification syntaxique (`node --check` / bracket-balance) sur tous les fichiers modifiés.
- [ ] Vérification visuelle réelle dans un navigateur — impossible dans cet environnement
      (pas de build Next.js exécutable faute d'accès npm) ; les SVG ont été construits avec des
      commandes de courbe bornées dans leur `viewBox` pour rester raisonnablement fiables sans
      prévisualisation, mais un contrôle visuel humain après déploiement reste recommandé.
