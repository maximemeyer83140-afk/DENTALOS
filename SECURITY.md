# SECURITY.md — DentalOS

DentalOS manipule des données médicales et financières. La sécurité prime sur la vitesse de
livraison. Ce document décrit le modèle de menaces retenu, les contrôles techniques prévus et ce
qui reste à durcir avant toute utilisation réelle (voir aussi `COMPLIANCE.md`).

## 1. Modèle de menaces (résumé)

| Acteur / scénario | Risque | Contrôle principal |
| --- | --- | --- |
| Utilisateur légitime d'une organisation accédant aux données d'une autre organisation | Fuite de données médicales entre cabinets concurrents/indépendants | Isolation tenant systématique (ARCHITECTURE.md §5) + test automatisé dédié |
| Employé avec un rôle limité (assistant, réceptionniste) élevant ses privilèges | Accès à des données cliniques/financières hors de son périmètre | RBAC vérifié côté serveur à chaque requête, jamais côté client seul |
| Attaquant externe (credential stuffing, brute force) | Prise de contrôle d'un compte praticien/admin | Rate limiting sur l'authentification, MFA, verrouillage progressif |
| Attaquant avec accès réseau (MITM) | Interception de données patient en transit | TLS obligatoire partout, HSTS |
| Fuite de la base de données (backup volé, accès direct) | Exposition de tout l'historique médical/financier | Chiffrement au repos, secrets hors code, accès base restreint |
| Employé quittant le cabinet avec des exports non autorisés | Fuite de données patient à grande échelle | Permissions d'export dédiées, journalisation systématique de tout export |
| Manipulation financière interne (facture modifiée après validation, rétrocession trafiquée) | Fraude, litige | Factures validées immuables, `AuditLog` sur toute modification sensible, avoir/correction uniquement |
| Perte de note clinique finalisée (écrasement accidentel) | Dossier médical incomplet, risque patient et responsabilité légale | `ClinicalNoteRevision`/`PatientMedicalProfileRevision` — jamais d'écrasement silencieux |
| Webhook/intégration tierce compromise | Injection de données ou exfiltration | Signature cryptographique des webhooks, retries bornés, logs |

## 2. Contrôles techniques

### Transport et stockage

- TLS partout (pas d'exception en développement pour les données réelles — les environnements de
  dev n'utilisent que des données fictives, section 77).
- Chiffrement au repos pour la base de données et les fichiers stockés, dès que l'hébergement est
  choisi (décision D4, `ARCHITECTURE.md` §9).
- Secrets (clés API, secrets d'auth, identifiants base de données) exclusivement via variables
  d'environnement / gestionnaire de secrets. **Jamais** commités dans le dépôt — `.gitignore`
  exclut `.env*`, `.env.example` ne contient que des valeurs factices.

### Authentification et sessions

- MFA supporté dès la conception du modèle (`User.mfaEnabled`) — activation dépend du fournisseur
  choisi (décision D1).
- Rate limiting sur les endpoints d'authentification et tout endpoint sensible (émission de
  facture, export, changement de permissions).
- Sessions sécurisées (cookies `HttpOnly`, `Secure`, `SameSite`) — détail dépend du fournisseur
  d'auth retenu.
- Verrouillage progressif après échecs répétés (à spécifier avec le choix d'authentification).

### Contrôle d'accès (RBAC)

- Permissions granulaires par ressource × action (`patients.read`, `invoices.validate`, ...) — la
  liste de référence vit dans `packages/database/src/permissions.ts`, seedée en base
  (`Permission`), assignée à des `Role` via `RolePermission`, et attribuée par clinique via
  `UserClinicAccess`.
- **Toute vérification de permission est effectuée côté serveur** (repository/service layer), à
  chaque requête. L'UI peut masquer des actions non permises pour l'ergonomie, mais ce n'est
  jamais le seul rempart.
- Principe du moindre privilège par défaut pour tout nouveau rôle créé.

### Entrées utilisateur

- Validation stricte côté serveur de toute entrée (schémas de validation — ex. Zod — à la
  frontière de chaque service, avant toute écriture).
- Requêtes paramétrées / ORM (Prisma) exclusivement — pas de concaténation SQL brute.
- Protection XSS : échappement systématique côté React (comportement par défaut de JSX — vigilance
  particulière sur tout `dangerouslySetInnerHTML`, à proscrire sauf cas justifié et revu).
- Protection CSRF : gérée par les mécanismes natifs de Next.js pour les Server Actions
  (vérification d'origine) ; à revalider explicitement une fois l'authentification choisie.

### Traçabilité

- `AuditLog` (append-only) sur : dossiers patients, modifications médicales, factures, paiements,
  changements de permissions, exports, suppressions, accès à des données sensibles selon la
  politique retenue par le cabinet.
- Interface de consultation de l'audit réservée aux rôles autorisés (`audit.read`).
- Logs techniques (application, erreurs, performance) **ne doivent jamais contenir de données
  médicales complètes** — uniquement des identifiants et métadonnées nécessaires au diagnostic.

### Sauvegardes et continuité

- Stratégie détaillée dans un futur `BACKUP_AND_RECOVERY.md` (mentionné en section 63 du cahier des
  charges, à produire avant la mise en production réelle — pas un artefact Phase 0).
- Principe retenu dès maintenant : un backup non testé par une procédure de restauration n'est pas
  considéré comme une stratégie de récupération valide.

## 3. Ce qui est fait en Phase 0 vs. ce qui reste à faire

**Fait en Phase 0** : modèle de données posant les bases de l'isolation tenant et de l'audit
(`AuditLog`, révisions cliniques), structure RBAC (`Role`/`Permission`/`RolePermission`/
`UserClinicAccess`), TypeScript strict pour réduire la classe de bugs la plus courante,
`.gitignore` excluant les secrets, `.env.example` sans valeur réelle.

**Explicitement non fait en Phase 0** (à ne pas confondre avec "fait") : authentification
fonctionnelle, MFA opérationnel, rate limiting, vérification de permissions au runtime, chiffrement
au repos effectif, tests d'isolation tenant automatisés, pentest, monitoring de sécurité. Ces
éléments sont planifiés dans `ROADMAP.md` (Phases 1 et 10) et ne doivent jamais être présentés
comme acquis avant d'être réellement implémentés et vérifiés.

## 4. Avant toute mise en production

Reprend et complète la section 87 du cahier des charges — à traiter comme une checklist bloquante,
pas indicative :

- [ ] Revue de sécurité professionnelle (idéalement externe)
- [ ] Revue juridique suisse (protection des données, secret professionnel)
- [ ] Revue protection des données (nLPD / RGPD si patients UE)
- [ ] Validation métier de la facturation/tarification par un expert comptable/dentaire
- [ ] Validation du générateur QR-facture par rapport au standard officiel
- [ ] Test de restauration de sauvegarde (pas seulement de sauvegarde)
- [ ] Tests automatisés d'isolation tenant (Organization A ne voit jamais Organization B)
- [ ] Test de charge
- [ ] Pentest
- [ ] Monitoring et alerting en place
- [ ] Plan de réponse à incident documenté
- [ ] DPA (Data Processing Agreement) signés avec chaque sous-traitant (hébergeur, email, SMS, ...)
- [ ] Politique de conservation et de suppression des données définie et appliquée
- [ ] Politique d'accès du personnel (qui voit quoi, revue périodique des accès)
