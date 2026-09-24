# PHASE 17 — Liste d'attente : rattachement obligatoire à un rendez-vous fixé (ÉTAPE 21)

## Contexte

Correction explicite de l'utilisateur après audit du vrai backend (voir PHASE_16.md) : la liste
d'attente y existait déjà comme repository (`waiting-list.ts`, construit en Phase 3) mais sans
aucune UI, et surtout avec une sémantique fausse — un vœu libre (`patientId` + éventuellement
`appointmentTypeId`/`preferredPractitionerId`/`desiredDurationMinutes`), sans aucun lien vers un
vrai rendez-vous. Message de l'utilisateur, verbatim : « les patients en liste d'attente sont des
patients à qui on doit avoir fixé un rdv et qui sont disponibles avant si annulation par un autre,
ok pour mettre en liste d'attente il faut que le patient ait déjà un rdv de prévu. » Un patient en
liste d'attente n'exprime donc jamais « je veux un rendez-vous de tel type » — il a déjà un
rendez-vous réservé et veut une place plus tôt si quelqu'un annule.

## Décisions de conception

**`appointmentId` obligatoire remplace les trois champs libres.** `WaitingListEntry` perd
`appointmentTypeId`, `preferredPractitionerId`, `desiredDurationMinutes` (aucun autre fichier du
dépôt ne les référençait — confirmé par recherche globale) au profit d'un unique `appointmentId`
requis, relié à `Appointment` (`onDelete: Cascade` : si le rendez-vous disparaît, l'entrée de liste
d'attente n'a plus de sens). Le type de rendez-vous, le praticien et la durée souhaités se lisent
désormais sur `appointment` lui-même — il n'y a plus deux sources de vérité qui pourraient diverger.

**`patientId` n'est plus jamais saisi : toujours dérivé du rendez-vous.** `addToWaitingList` ne
prend plus qu'`{ appointmentId, urgency?, availabilityNotes? }` en entrée ; le patient vient de
`appointment.patientId`. Ceci élimine par construction toute incohérence entre "patient en liste
d'attente" et "patient du rendez-vous".

**Validation métier complète côté repository, pas seulement côté UI.** `addToWaitingList` refuse
explicitement (erreurs en français, remontées telles quelles jusqu'au formulaire) :
- un rendez-vous introuvable dans le tenant courant (`NotFoundError`, comme partout ailleurs) ;
- un créneau sans patient réel (`patientId` null — un bloc administratif, pas un rendez-vous
  patient) ;
- un rendez-vous déjà `cancelled` ou `no_show` ;
- un rendez-vous déjà passé (`startAt <= now`) ;
- un doublon : un rendez-vous déjà en liste d'attente active (`waiting`/`offered`) ne peut pas y
  être ajouté deux fois.

**Le formulaire d'ajout ne permet de choisir qu'un rendez-vous existant.** Pas de champ patient ni
type de rendez-vous en saisie libre : `AddToWaitingListForm` affiche un `<select>` peuplé
côté serveur par `listAppointmentsForRange(ctx, now, +90 jours)`, filtré aux rendez-vous avec un
vrai patient, non annulés/manqués, et pas déjà en liste d'attente — la même règle que le
repository refuse ensuite server-side (défense en profondeur, pas une simple UX).

**`findWaitingListMatchesForSlot` posé pour l'intégration future avec l'annulation.** Retourne les
entrées en attente dont le rendez-vous partage le même `appointmentTypeId` que le créneau qui vient
de se libérer — utile pour suggérer "3 patients en attente compatibles" lors d'une annulation, mais
rien dans le flux d'annulation actuel ne l'appelle encore (hors scope de cette phase).

**Permission réutilisée : `agenda.write`/`agenda.read`.** La liste d'attente est un sous-produit de
l'agenda (elle ne concerne que des rendez-vous déjà planifiés), pas un nouveau domaine — pas de
nouvelle clé de permission, comme les Ordonnances avaient réutilisé `clinical.write` en Phase 16.

## Changements base de données

- `WaitingListEntry` : suppression de `appointmentTypeId`, `preferredPractitionerId`,
  `desiredDurationMinutes` ; ajout de `appointmentId` (obligatoire) + relation `appointment`
  (`onDelete: Cascade`) ; nouvel index `@@index([appointmentId])`.
- `Appointment.waitingListEntries` : relation inverse ajoutée.
- **Toujours aucune migration Prisma générée** — même contrainte réseau que documentée en
  PHASE_15.md et PHASE_16.md (`registry.npmjs.org` refusé explicitement par la politique d'egress
  de cet environnement, confirmé à nouveau au début de cette session ; l'utilisateur a tenté
  d'autoriser l'hôte côté réglages de l'environnement puis a explicitement demandé de continuer
  sans accès réseau). **Avant tout déploiement**, exécuter `pnpm install`, puis
  `pnpm db:generate && pnpm db:migrate` (première migration à générer pour l'ensemble du schéma,
  voir PHASE_16.md) depuis un environnement avec accès à npm.

## Fichiers

- `packages/database/prisma/schema.prisma` — `WaitingListEntry` redéfini, relation inverse sur
  `Appointment`.
- `packages/database/src/repositories/waiting-list.ts` (réécrit) — `listWaitingList` (avec
  `include` patient + rendez-vous), `addToWaitingList` (validations ci-dessus),
  `removeFromWaitingList` (inchangé), `findWaitingListMatchesForSlot` (nouveau, pas encore appelé).
- `packages/database/src/repositories/waiting-list.test.ts` (nouveau) — cas nominal, chacun des
  refus listés ci-dessus, isolation multi-tenant (ajout et retrait), retrait.
- `apps/web/src/lib/validation/waiting-list.ts` (nouveau) — `addToWaitingListSchema`.
- `apps/web/src/app/liste-attente/actions.ts` (nouveau) — `addToWaitingListAction`,
  `removeFromWaitingListAction`, permission `agenda.write`.
- `apps/web/src/app/liste-attente/page.tsx` (nouveau) — worklist clinique, filtre les rendez-vous
  éligibles pour le formulaire d'ajout.
- `apps/web/src/app/liste-attente/AddToWaitingListForm.tsx` (nouveau) — sélection d'un rendez-vous
  existant, urgence, notes de disponibilité.
- `apps/web/src/app/liste-attente/WaitingListRow.tsx` (nouveau) — ligne de la worklist + action de
  retrait, suit le patron de `RecallDashboardRow.tsx`.
- `apps/web/src/components/AppNav.tsx` — lien "Liste d'attente" ajouté (gated `agenda.read`, entre
  "Rappels" et "Tâches").

## Sécurité

Mêmes garde-fous que le reste du dépôt : `requirePermission(clinicId, "agenda.write"|"agenda.read")`
sur les Server Actions et la page ; `addToWaitingList` revérifie `organizationId`/`clinicId` du
rendez-vous avant tout accès (`NotFoundError` sinon, jamais de fuite d'existence croisée) ;
`removeFromWaitingList` revérifie `organizationId`/`clinicId` de l'entrée elle-même — testé
explicitement (une organisation ne peut ni ajouter un rendez-vous d'une autre, ni retirer son
entrée).

## Tests

`waiting-list.test.ts` écrit et vérifié syntaxiquement (`node --experimental-strip-types --check`,
qui passe sans erreur sur les quatre fichiers `.ts` de cette phase) mais **jamais exécuté contre une
vraie base** — même contrainte réseau que PHASE_16.md (`pnpm install` toujours bloqué par la
politique d'egress de cet environnement). Les trois fichiers `.tsx` n'ont pas de vérification
syntaxique possible sans npm ; un comptage manuel des accolades/parenthèses/crochets (script Python,
même méthode que PHASE_15/PHASE_16) a été fait et est équilibré sur les quatre fichiers touchés
(y compris `AppNav.tsx`).

**Avant tout déploiement réel**, exécuter dans un environnement avec accès réseau : `pnpm install`,
`pnpm db:generate`, `pnpm db:migrate`, puis `pnpm typecheck && pnpm lint && pnpm test`.

## Limitations connues

- **`findWaitingListMatchesForSlot` non branché.** Prêt côté repository mais rien dans le flux
  d'annulation d'un rendez-vous (`updateAppointmentStatus`) n'appelle encore cette fonction pour
  suggérer les patients en attente compatibles — c'est pourtant le scénario métier qui donne son
  sens à toute la fonctionnalité ("patient disponible avant, si annulation par un autre"). Hors
  scope de cette phase, mais c'est la suite naturelle.
- **Fenêtre de 90 jours arbitraire.** Le formulaire ne propose que les rendez-vous des 90 prochains
  jours (`listAppointmentsForRange`) — un patient déjà en attente pour un rendez-vous plus lointain
  ne peut pas encore être ajouté depuis cette page (il faudrait soit élargir la fenêtre, soit
  ajouter une recherche).
- **Dashboard racine et aperçu d'impression des devis** restent hors scope, comme déjà noté en
  PHASE_16.md.
- **Code entièrement non vérifié à l'exécution**, comme toutes les phases précédentes depuis que
  cette contrainte réseau existe (voir Tests).

## Definition of Done

- [x] `WaitingListEntry.appointmentId` obligatoire + relation, champs libres supprimés.
- [x] Repository réécrit avec toutes les validations métier + isolation multi-tenant + tests.
- [x] Validation Zod.
- [x] Server Actions (`agenda.write`/`agenda.read`).
- [x] UI : worklist clinique `/liste-attente`, formulaire d'ajout limité aux rendez-vous existants,
      retrait.
- [x] Lien AppNav.
- [x] Vérification syntaxique disponible sans npm (`node --check` sur les `.ts`, comptage de
      symboles équilibrés sur les `.tsx`).
- [ ] **Migration Prisma générée et appliquée** — impossible sans accès réseau dans cette session.
- [ ] **`pnpm install`/`typecheck`/`lint`/`test` exécutés au moins une fois** — toujours jamais fait
      dans aucune session de ce projet.
- [ ] **`findWaitingListMatchesForSlot` intégré au flux d'annulation** — hors scope, noté comme
      suite naturelle.
