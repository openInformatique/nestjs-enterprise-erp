# Progression de l'implémentation

Socle back-end `nestjs-enterprise-starter` — NestJS 11, TypeORM, SQL Server 2022, Docker.

## Étapes

- [x] Étape 1 — Audit initial du workspace
- [x] Étape 2 — Initialisation (NestJS, Git, npm, lockfile, .gitignore, .editorconfig)
- [x] Étape 3 — TypeScript strict et qualité (ESLint, Prettier, scripts)
- [x] Étape 4 — Architecture initiale (arborescence, modules vides)
- [x] Étape 5 — Configuration typée et validation des environnements
- [x] Étape 6 — Docker SQL Server (compose, volume, healthcheck, scripts)
- [x] Étape 7 — Initialisation des bases (db:init, doc SSMS)
- [x] Étape 8 — TypeORM (DataSource, transactions, scripts migrations)
- [x] Étape 9 — Entités et migrations (users, auth_sessions, audit_logs)
- [x] Étape 10 — Seeders
- [x] Étape 11 — Composants communs (pagination, filtres, tri, décorateurs)
- [x] Étape 12 — Validation globale et gestion des erreurs
- [x] Étape 13 — Enveloppe standardisée des réponses
- [x] Étape 14 — Logging Pino, request ID et contexte de requête
- [x] Étape 15 — Module d'audit
- [x] Étape 16 — Sécurité HTTP (Helmet, CORS, rate limiting)
- [x] Étape 17 — Module utilisateurs
- [x] Étape 18 — Authentification (login, JWT, sessions, rotation, révocation)
- [x] Étape 19 — Préparation SSO (contrats, provider local)
- [x] Étape 20 — Préparation des permissions (contrats neutres)
- [x] Étape 21 — Swagger / OpenAPI
- [x] Étape 22 — Santé de l'application (health, live, ready)
- [x] Étape 23 — Métriques Prometheus
- [x] Étape 24 — Module e-mails
- [x] Étape 25 — Module stockage de fichiers
- [x] Étape 26 — Module génération PDF
- [x] Étape 27 — Scheduler (nettoyage des sessions expirées)
- [x] Étape 28 — Tests d'intégration
- [x] Étape 29 — Tests end-to-end
- [x] Étape 30 — Collection Postman
- [x] Étape 31 — Documentation complète
- [x] Étape 32 — Validation finale (lint, build, tests, migrations, seed)

## Décisions techniques

- **Environnement vérifié** : Node v24.15.0 (LTS), npm 11.12.1, Docker 29.6.1 — conformes au cahier des charges.
- Le workspace contenait uniquement `nestjs-openinformatique-starter.md` (cahier des charges) : conservé.
- **TypeORM 1.1.0** retenu : c'est la version stable `latest` sur npm (la 0.3.31 est taguée `legacy`) ; compatible @nestjs/typeorm 11 et SQL Server.
- **Healthcheck Docker** : `sqlcmd -S 127.0.0.1` (et non `localhost`, résolu en IPv6 dans le conteneur, ce qui faisait échouer la sonde).
- **Port 1433 conservé** pour ce projet (choix utilisateur) ; le conteneur `nest-erp-sqlserver` d'un autre projet a vu sa politique de redémarrage passée à `no` pour éviter le conflit de port.
- Fichiers de démonstration NestJS (app.controller/service Hello World) supprimés : le socle n'expose aucun endpoint de démonstration hors configuration explicite.
- `passWithNoTests` activé temporairement sur Jest tant que les suites de tests unitaires des composants communs ne sont pas créées.
- **Migrations générées incrémentalement** (une entité à la fois) pour obtenir trois migrations nommées CreateUsersTable, CreateAuthSessionsTable, CreateAuditLogsTable sans dérive schéma/entités.
- **Seeder** : pas de sessions de démonstration semées (fabriquer de faux hashes de refresh token n'apporte rien) ; utilisateurs `admin@local.dev` et `user@local.dev` créés, mots de passe via SEED_ADMIN_PASSWORD/SEED_USER_PASSWORD ou générés et affichés en console.
- **Enveloppe** : détection des résultats paginés par forme (items + meta.page) ; exclusions : @SkipResponseEnvelope(), StreamableFile, Buffer, 204, réponse déjà émise.
- **Contexte de requête** : AsyncLocalStorage via RequestContextService (module global) ; enrichi par le futur guard JWT (userId/sessionId).
- **Validation de démarrage réelle effectuée** : boot local OK, 404 renvoie l'enveloppe d'erreur standard + en-tête x-request-id, logs Pino corrélés.
- **Authentification** : refresh token haché en SHA-256 (valeur signée à haute entropie ; Argon2id réservé aux mots de passe) ; détection de réutilisation par comparaison d'empreinte AVANT les contrôles de révocation/expiration ; provider local avec vérification factice anti-énumération (temps de réponse homogène) ; guard JWT global (routes protégées par défaut, @Public() pour ouvrir) ; guard ne vérifie PAS la session en base à chaque requête (access token court reste valide jusqu'à expiration — documenté).
- **Rate limiting** : 100 req/min global (10 000 en test), login 5/min, refresh 30/min par IP.
- **Login réel testé** : POST /api/v1/auth/login avec l'admin seedé → 200, cookie HttpOnly path=/api/v1/auth, en-têtes Helmet et X-RateLimit corrects.
- Étapes 19/20 : IdentityProviderPort + LocalIdentityProvider injecté via IDENTITY_PROVIDER ; AuthorizationPort/Permission/AuthorizationRequirement + décorateur @RequiresPermission (métadonnées seulement, aucun guard permissif).

## Écarts par rapport au plan

- Aucun pour le moment.

## Points restant à réaliser

- Aucun : les 32 étapes sont terminées et validées.
- Améliorations futures possibles (hors périmètre) : fournisseur SSO concret,
  modèle de rôles/permissions, environnement production, verrou distribué du
  scheduler en multi-instances, protection réseau de /metrics.

## Validation finale (étape 32) — tout au vert

- `npm ci` → OK (0 vulnérabilité)
- `npm run lint` → OK
- `npm run format:check` → OK
- `npm run build` → OK
- `npm run test:unit` → 21 suites, 104 tests ✓
- `npm run test:integration` → 4 suites, 15 tests ✓ (SQL Server réel)
- `npm run test:e2e` → 2 suites, 22 tests ✓ (Supertest)
- `npm run test:cov` → couverture générée (informative, ~41 % lignes)
- `npm run docker:db:up` → conteneur healthy
- `npm run db:init` → idempotent OK
- `npm run migration:run` → « No migrations are pending »
- `npm run seed` → idempotent OK
- Boot réel vérifié : health 200, Swagger UI 200, docs-json 200, /metrics 200 ;
  login réel avec l'admin seedé (cookie HttpOnly, Helmet, rate limit).

## Commandes de validation exécutées

- `node --version` → v24.15.0
- `npm --version` → 11.12.1
- `docker --version` → 29.6.1
- `npm run build` → OK (mode strict complet activé)
- `npm run lint` → OK (0 erreur)
- `npm run test:unit` → OK (1 suite, 1 test)
