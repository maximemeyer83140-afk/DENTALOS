# ROADMAP.md — DentalOS

Développement par phases, jamais toutes les fonctionnalités en parallèle (section 75 du cahier des
charges). Chaque phase, avant d'être codée, reçoit son propre document `docs/phases/PHASE_X.md`
(objectifs, user stories, changements DB, API, UI, permissions, sécurité, tests, Definition of
Done — section 76). Une phase n'est jamais considérée terminée si le build échoue, si le typecheck
échoue, ou si les tests échouent.

## Phase 0 — Architecture (ce commit)

Fondations : documents de référence, monorepo, modèle de données initial, outillage
(TypeScript strict, lint, format, tests, CI). Voir `docs/phases/PHASE_0.md` pour le détail exécuté
et les limitations rencontrées dans cet environnement.

## Phase 1 — Core

Authentification (décision D1 à trancher en premier), `Organization`/`Clinic`, gestion des
utilisateurs, RBAC appliqué au runtime (vérifications serveur sur chaque endpoint), `AuditLog`
câblé, paramètres de base. **Definition of done incontournable** : test automatisé prouvant
qu'un utilisateur de l'Organization A ne peut jamais lire/écrire une donnée de l'Organization B.

## Phase 2 — Patients

Fiche patient complète, informations médicales structurées et versionnées, alertes médicales
visibles immédiatement, documents liés au patient, timeline clinique (structure d'accueil des
événements des phases suivantes).

## Phase 3 — Agenda

Rendez-vous, praticiens, salles/fauteuils, types de rendez-vous configurables, moteur de détection
de conflit (jamais uniquement côté frontend), liste d'attente.

## Phase 4 — Clinique

Odontogramme interactif (FDI, historisé), notes cliniques (avec révisions, jamais d'écrasement
silencieux), charting parodontal, plans de traitement (scénarios multiples), devis.

## Phase 5 — Facturation

Moteur tarifaire suisse (catalogues/versions/règles, jamais de tarif codé en dur), factures
(brouillon → validée, immuable une fois validée), avoirs, paiements (allocation multi-factures),
QR-facture suisse conforme au standard (`SwissQrBillService`), suivi des débiteurs.

## Phase 6 — Stocks

Produits, lots et traçabilité, mouvements de stock (source de vérité, pas une colonne mutée),
fournisseurs, commandes (réception partielle), alertes de seuil/péremption.

## Phase 7 — Finance

Charges (ponctuelles et récurrentes), coûts laboratoire, calcul des rétrocessions praticien
(`CompensationEngine`, auditable), rentabilité par acte/patient/praticien/clinique.

## Phase 8 — Analytics

KPIs (production, encaissement, occupation, acceptation de devis, recall, ...), dashboards
(cabinet du jour, finance center, inventory center, command center owner), objectifs, exports.

## Phase 9 — Communication

Intégrations email/SMS (via les abstractions `EmailProvider`/`SmsProvider`, pas d'appel direct à
un SDK dans le code métier), templates, recalls automatisés (configurables, jamais un envoi
automatique sans consentement explicite du cabinet), moteur d'automatisation (trigger/condition/
action).

## Phase 10 — Hardening

Revue de sécurité, tests de performance, accessibilité (WCAG), suite E2E (Playwright), test de
sauvegarde/restauration réel, revue de conformité complète (`COMPLIANCE.md` passé en revue avec un
conseil juridique), `BACKUP_AND_RECOVERY.md`. Voir la checklist de mise en production dans
`SECURITY.md` §4 — bloquante, pas indicative.

## Hors-scope tant qu'aucune phase ne le justifie explicitement

Intelligence artificielle (section 72) : architecture préparée mais aucune fonctionnalité IA avant
que les phases 1 à 9 soient stables, et toujours avec validation humaine obligatoire pour toute
suggestion clinique. Extraction d'un backend séparé de Next.js : uniquement si un besoin concret
(charge, jobs asynchrones lourds) apparaît.
