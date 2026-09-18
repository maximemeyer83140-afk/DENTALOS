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
- [ ] `pnpm install && pnpm db:migrate && pnpm test` exécutés avec succès — **toujours bloqué**
      (même limitation réseau que les phases précédentes).
