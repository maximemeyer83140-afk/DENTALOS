# PHASE 3 — Agenda

## Objectifs

Rendez-vous, salles, types de rendez-vous, un moteur de détection de conflit **appliqué côté
serveur** (jamais seulement dans l'UI — section 82 du cahier des charges), et une liste d'attente.
Pas de vue calendrier drag & drop dans cette phase : une vue "jour" fonctionnelle d'abord, le
glisser-déposer viendra avec le design system complet (Phase 8+ UI).

## Changements base de données

Pas de nouveau modèle, mais une **correction** d'un oubli de la Phase 0 : `practitionerId` sur
`Appointment` (et, tant qu'à corriger, `ClinicalNote`, `TreatmentPlan`, `TreatmentPlanItem`,
`Treatment`, `Quote`, `Invoice`) était une simple colonne scalaire sans relation Prisma vers
`Practitioner`. Le principe "pas de relation formelle" de `ARCHITECTURE.md` §5 visait les
références d'audit incidentes (`createdBy`, `updatedBy`) — pas une relation métier de premier
ordre comme "quel praticien a ce rendez-vous/cette facture", qui a besoin d'être jointe partout
dans l'UI. Corrigé en ajoutant la relation `practitioner Practitioner @relation(...)` sur ces sept
modèles (et les tableaux inverses correspondants sur `Practitioner`) avant que Phase 4/5 ne
reproduisent le même problème.

## Décision prise dans cette phase

**Moteur de conflit** : un rendez-vous ne peut pas être créé ou déplacé si le praticien ou la
salle ont déjà un rendez-vous non annulé qui chevauche le créneau demandé. Vérifié dans la même
transaction que l'écriture (`checkAppointmentConflict` dans
`packages/database/src/services/appointment-conflict.ts`), jamais uniquement dans le composant
calendrier. Deux réceptionnistes qui réservent le même fauteuil au même instant : la seconde
écriture doit échouer, pas silencieusement écraser la première.

## API / logique serveur

- `packages/database/src/services/appointment-conflict.ts` — `assertNoConflict(tx, {clinicId,
  practitionerId, roomId?, startAt, endAt, excludeAppointmentId?})`, lève `ConflictError` si un
  rendez-vous existant (statut hors `cancelled`) chevauche pour le même praticien OU la même salle.
- `packages/database/src/repositories/appointments.ts` — `listAppointmentsForDay`,
  `getAppointment`, `createAppointment` (vérifie le conflit dans la transaction),
  `updateAppointmentStatus`, `rescheduleAppointment` (revérifie le conflit).
- `packages/database/src/repositories/rooms.ts`, `appointment-types.ts` — CRUD minimal scopé
  tenant.
- `packages/database/src/repositories/waiting-list.ts` — `listWaitingList`, `addToWaitingList`,
  `removeFromWaitingList`.

## UI

- `/agenda` — vue jour (sélecteur de date via `?date=`), liste des rendez-vous du jour toutes
  salles/praticiens confondus, changement de statut en un clic (comme le prototype interactif,
  mais branché sur de vraies données).
- `/agenda/new` — création d'un rendez-vous ; le formulaire affiche l'erreur de conflit renvoyée
  par le serveur si le créneau est déjà pris.

## Permissions

`agenda.read`, `agenda.write` (déjà présentes depuis la Phase 0).

## Tests

- `appointment-conflict.test.ts` : même praticien/même créneau → conflit détecté ; praticiens
  différents même créneau → pas de conflit ; même salle, praticiens différents → conflit détecté ;
  un rendez-vous annulé ne bloque plus le créneau.
- `appointments.test.ts` : isolation tenant (même schéma que les phases précédentes).

## Definition of Done

- [x] Services et repositories écrits (conflit, rendez-vous, salles, types, liste d'attente)
- [x] UI vue jour + création
- [x] Tests de détection de conflit et d'isolation tenant écrits
- [x] Refonte calendrier (addendum ci-dessous)
- [ ] `pnpm install && pnpm db:migrate && pnpm test` exécutés avec succès — **toujours bloqué**
      (même limitation réseau que les phases précédentes).

## Addendum — refonte complète du calendrier (ÉTAPE 1 d'un plan en plusieurs étapes : Agenda →
Fiche patient, sur demande explicite de l'utilisateur ; seule l'Agenda est traitée ici)

La première version de l'Agenda (liste verticale des rendez-vous du jour, création sur une page
séparée `/agenda/new`) fonctionnait mais ne ressemblait pas à un agenda professionnel de cabinet
dentaire. Cet addendum la remplace par un vrai calendrier visuel, en réutilisant au maximum ce qui
existait déjà (moteur de conflit, repositories, RBAC, schéma — rien de tout ça n'a changé de
nature, seulement étendu).

### Changements base de données

Aucun nouveau modèle. `AppointmentType` (nom/couleur/durée par défaut), `Room`, et
`Appointment.status` (incluant déjà `no_show`) existaient depuis la Phase 0 mais n'étaient ni
seedés ni exploités par l'UI. Le seed ajoute désormais 10 types de rendez-vous réels (Consultation,
Contrôle, Détartrage, Soins, Endodontie, Prothèse, Chirurgie, Implantologie, Urgence, Orthodontie —
chacun avec une couleur et une durée par défaut), 2 salles, et quelques rendez-vous d'exemple sur la
journée courante pour que le calendrier ne soit jamais vide à la première ouverture.

### API / logique serveur

- `packages/database/src/repositories/appointments.ts` :
  - `listAppointmentsForRange(ctx, start, end)` — généralisation de `listAppointmentsForDay` (qui
    délègue maintenant à cette fonction) pour couvrir une semaine entière en une requête ; `end` est
    exclusif.
  - `updateAppointment(ctx, id, input)` — édition complète (patient, praticien, salle, type, heure,
    notes), distincte de `rescheduleAppointment` (qui reste le chemin léger du glisser-déposer, qui
    ne touche que l'heure). Ne relance le moteur de conflit que si l'heure, le praticien ou la salle
    changent réellement — modifier seulement les notes ou le type sur un créneau par ailleurs
    inchangé ne doit jamais être bloqué par un conflit qui n'a rien à voir avec les champs modifiés.
- `apps/web/src/app/agenda/actions.ts` : `createAppointmentAction`/`updateAppointmentAction` (liés à
  un formulaire, renvoient `{error}` ou `{ok:true}` — plus de redirection de page puisque tout se
  passe dans une modale), `rescheduleAppointmentByDragAction` (chemin impératif pour le
  glisser-déposer), `searchPatientsAction` (recherche instantanée, réutilise
  `listPatients(ctx,{search})` qui existait déjà), `quickCreatePatientAction` (« + Nouveau patient »
  sans quitter la prise de rendez-vous — réutilise `createPatient`, formulaire volontairement minimal
  ; le formulaire patient complet est l'ÉTAPE 2, pas celle-ci).
- `apps/web/src/lib/agenda-layout.ts` — `layoutDayAppointments` : algorithme de répartition en
  « couloirs » pour afficher côte à côte deux rendez-vous qui se chevauchent dans une même colonne
  jour (deux praticiens différents au même horaire, en vue semaine). Un praticien donné n'a jamais
  deux rendez-vous actifs qui se chevauchent (le moteur de conflit l'interdit), donc les couloirs
  n'apparaissent que quand plusieurs praticiens partagent une colonne. Testé isolément
  (`agenda-layout.test.ts`) : pas de chevauchement → 1 couloir chacun ; chevauchement → 2 couloirs ;
  un rendez-vous chevauchant tôt dans la journée ne doit pas rétrécir un rendez-vous isolé plus tard
  ; un couloir libéré est réutilisé par un rendez-vous suivant qui ne chevauche que le second, pas
  le premier.

### UI

- `/agenda?view=week|day&date=YYYY-MM-DD` — un seul écran, deux vues :
  - **Semaine** : 7 colonnes (jours), heures verticales (grille 15 min, une heure = 4 lignes) — un
    rendez-vous d'1h occupe visuellement deux fois la hauteur d'un rendez-vous de 30 min, comme
    demandé.
  - **Jour** : une colonne par praticien (utile dès que le cabinet a plusieurs praticiens ; repli sur
    une colonne unique sinon) — non demandé explicitement mais cohérent avec « comprendre
    l'organisation de ma journée en quelques secondes » quand plusieurs praticiens travaillent le
    même jour.
  - Navigation : ← / →, bouton « Aujourd'hui », sélecteur de date natif pour aller à n'importe quelle
    date. Bascule Jour/Semaine sans perdre la date affichée.
  - Clic sur un créneau vide → modale de création pré-remplie (date, heure, praticien de la colonne
    cliquée). Bloc de rendez-vous → survol affiche une fiche détaillée (patient, horaire, type,
    salle, statut), clic ouvre la modale d'édition.
  - Glisser-déposer un rendez-vous vers un autre créneau/jour pour le déplacer (API HTML5 Drag and
    Drop native — fonctionne à la souris ; sur écran tactile, ouvrir le rendez-vous et modifier
    l'heure reste le chemin fiable, limitation connue).
  - `AppointmentModal.tsx` : recherche patient instantanée (debounce 250 ms), bouton
    « + Nouveau patient » ouvrant un mini-formulaire sans quitter la modale, sélection du praticien/
    salle/type (le type pré-remplit la durée, modifiable ensuite), date/heure/durée avec heure de fin
    calculée et affichée, notes, lien direct « Ouvrir le dossier → » vers `/patients/[id]` dès qu'un
    patient est sélectionné. En édition : bandeau de statut avec actions en un clic (Confirmer,
    Marquer arrivé, Installer au fauteuil, Terminer, Absent, Annuler, Réactiver) séparées du
    formulaire principal — un changement de statut n'exige pas d'enregistrer tout le formulaire.
- `/agenda/new` supprimée (remplacée par la modale) ; `StatusActions.tsx` supprimé (sa logique,
  étendue avec `no_show`, vit maintenant dans `AppointmentModal.tsx`).

### Permissions

Inchangées : `agenda.read`, `agenda.write` pour les rendez-vous ; `patients.read`/`patients.write`
pour la recherche et la création rapide de patient (la modale ne contourne pas ces vérifications).

### Tests

- `appointments.test.ts` (étendu) : `listAppointmentsForRange` couvre plusieurs jours et exclut
  correctement la borne de fin ; `updateAppointment` change l'heure sans toucher aux champs non
  fournis ; ne relance le moteur de conflit que si un champ pertinent change réellement (modifier
  juste une note n'est jamais bloqué par un conflit sans rapport) ; peut vider le patient (bloc
  réservé) sans erreur.
- `agenda-layout.test.ts` : voir ci-dessus.

### Limitation connue

Le glisser-déposer utilise l'API HTML5 native (pas de bibliothèque tierce, cohérent avec
l'absence d'accès npm dans ce bac à sable) — robuste à la souris, pas optimisé tactile. À
reconsidérer si un usage sur tablette devient prioritaire.
