# COMPLIANCE.md — DentalOS

DentalOS est destiné au marché suisse et manipule des données médicales et financières couvertes
par le secret professionnel. **Ce document liste des hypothèses de travail et des points
nécessitant une validation juridique, comptable ou médicale — il ne constitue en aucun cas une
attestation de conformité.** Aucune fonctionnalité codée ne rend, à elle seule, la plateforme
"conforme" : la conformité dépend aussi de mesures organisationnelles (contrats, processus internes
du cabinet, formation du personnel) hors du périmètre du code.

## 1. Hypothèses de travail (à confirmer juridiquement)

1. Les données traitées relèvent au minimum de la LPD (loi fédérale sur la protection des données,
   révisée) et du secret professionnel médical (art. 321 CP pour les praticiens concernés). Si des
   patients résidents UE sont traités, le RGPD peut s'appliquer en parallèle.
2. Le responsable du traitement est le cabinet/la clinique cliente (l'"Organization"), DentalOS
   agit comme sous-traitant technique. Un contrat de sous-traitance (DPA) est nécessaire avec
   chaque cabinet client, et avec chaque sous-traitant ultérieur de DentalOS (hébergeur, email,
   SMS, paiement, signature électronique).
3. L'hébergement des données doit, au minimum, offrir des garanties équivalentes à un hébergement
   suisse (voire être physiquement en Suisse) — décision D4 dans `ARCHITECTURE.md`, non tranchée.
4. La conservation des dossiers médicaux suit des durées minimales légales (habituellement de
   l'ordre de 10 ans en Suisse pour la documentation médicale, à confirmer avec un conseil
   juridique selon canton/spécialité) — DentalOS doit permettre de **ne pas supprimer** avant
   l'échéance, pas seulement de supprimer sur demande.

## 2. Exigences identifiées (mappées aux mesures techniques)

| Exigence | Mesure technique prévue | Statut Phase 0 |
| --- | --- | --- |
| Minimisation des données | Modèle de données scopé aux besoins métier déclarés, pas de collecte "au cas où" | Respecté par construction du schéma |
| Contrôle d'accès | RBAC granulaire, vérifié serveur (`SECURITY.md`) | Structure posée, application runtime à faire (Phase 1) |
| Traçabilité | `AuditLog` append-only sur les opérations sensibles | Table modélisée, écriture applicative à faire |
| Droit d'accès / export | Export des données d'un patient sur demande | Non implémenté — prévu avec le module Documents/Export (Phase 2/8) |
| Droit de rectification | Édition des données patient avec historique (pas d'écrasement silencieux pour le clinique) | Modélisé pour le dossier clinique/médical ; à étendre aux données administratives si exigé |
| Politique de conservation | Empêcher la suppression physique de dossiers médicaux/financiers avant l'échéance légale | `onDelete: Restrict` sur les relations patient → données cliniques/financières ; politique de rétention explicite à écrire (Phase 10) |
| Suppression / anonymisation quand légalement possible | Processus d'anonymisation dédié (pas un `DELETE` SQL) | Non implémenté — à concevoir avec un conseil juridique (quels champs anonymiser, quand) |
| Sauvegarde | Sauvegardes chiffrées, restauration testée | Non implémenté — `BACKUP_AND_RECOVERY.md` à produire avant production |
| Notification/gestion d'incident | Procédure de détection et notification en cas de violation de données | Non implémenté — à définir avec le DPO/conseil juridique du premier client pilote |
| Secret professionnel | Accès aux données cliniques limité aux rôles médicalement justifiés | RBAC distingue `clinical.read/write` de `invoices.read` etc. (ex. comptable sans accès clinique) |

## 3. Points nécessitant validation juridique

- Base légale exacte de conservation par type de document (dossier médical, radiographie, facture,
  consentement) et durée précise applicable.
- Conditions de sous-traitance ultérieure (hébergeur, email, SMS, paiement) et clauses DPA
  associées.
- Conditions de transfert de données hors Suisse le cas échéant (si un fournisseur cloud n'est pas
  suisse).
- Valeur juridique de la signature électronique retenue pour les consentements (simple, avancée,
  qualifiée) selon le type de document (section 37).
- Statut exact du secret professionnel vis-à-vis du personnel non-soignant (réceptionniste,
  comptable) ayant potentiellement accès à des informations médicales indirectes (ex. motif de
  rendez-vous).

## 4. Points nécessitant validation comptable

- Les montants et indicateurs financiers de DentalOS (CA, marge, EBITDA opérationnel indicatif,
  etc.) sont une **gestion opérationnelle**, pas une comptabilité légale certifiée (section 74).
  Toute UI affichant ces indicateurs doit le rendre explicite.
- Règles suisses de numérotation des factures, gestion de la TVA le cas échéant, et format exact
  attendu pour les avoirs/corrections.
- Modalités exactes de calcul des rétrocessions praticien (base de calcul, charges déductibles) —
  DentalOS fournit le moteur (`CompensationRule`/`CompensationStatement`), pas la règle métier par
  défaut, qui doit être validée cabinet par cabinet.
- Export attendu vers le logiciel de comptabilité du cabinet (format, fréquence).

## 5. Points nécessitant validation médicale

- Contenu et structure exacts du questionnaire médical structuré (`PatientMedicalProfile`) —
  actuellement générique (allergies, médicaments, conditions, grossesse, tabagisme,
  anticoagulants, notes de risque), à valider avec un praticien pour exhaustivité clinique.
- Terminologie et codes utilisés dans l'odontogramme (`DentalConditionType`) et le charting
  parodontal — alignement avec les conventions suisses habituelles à confirmer.
- Toute fonctionnalité d'aide à la décision (Phase ultérieure IA, section 72) : **aucune IA ne doit
  prendre seule une décision clinique** ; toute suggestion doit être présentée explicitement comme
  une aide nécessitant validation humaine du praticien. Ce principe est une contrainte de conception
  non négociable, à faire respecter dès la première fonctionnalité d'assistance.

## 6. Ce que ce document n'est pas

Ce n'est pas un certificat de conformité, ni une garantie que DentalOS respecte la LPD/le RGPD/le
secret professionnel dans sa forme actuelle (Phase 0 = fondations techniques uniquement, sans
fonctionnalité utilisateur). Avant toute utilisation avec de vraies données patient, voir la
checklist de `SECURITY.md` §4 et section 87 du cahier des charges.
