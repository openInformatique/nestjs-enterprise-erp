# nestjs-enterprise-starter

Socle back-end d'entreprise : **NestJS 11 · TypeScript strict · TypeORM · Microsoft SQL Server 2022 · Docker**.

Base technique robuste, modulaire, sécurisée, testée et documentée, destinée à démarrer rapidement les futures API de l'entreprise. Le socle est strictement technique : aucune logique métier (clients, produits, commandes...) n'y figure.

## Fonctionnalités

- Monolithe modulaire inspiré Clean Architecture / hexagonale (couches `domain` / `application` / `infrastructure` / `presentation`)
- Authentification locale JWT : access token court + refresh token en cookie HttpOnly, **rotation** et **détection de réutilisation**, gestion des sessions
- Journal d'audit persistant, distinct des logs techniques
- Logs structurés Pino avec request ID et redaction des secrets
- Enveloppe JSON standardisée (réponses et erreurs) avec codes d'erreur stables
- Pagination / tri / filtres / recherche sécurisés (listes blanches, SQL paramétré)
- Santé (live/ready), métriques Prometheus, Swagger
- Briques techniques : e-mails (dev + SMTP), stockage de fichiers local, génération PDF, tâches planifiées
- Points d'extension SSO et permissions (contrats neutres, sans fausse implémentation)

## Prérequis

| Outil | Version |
| --- | --- |
| Node.js | 24 LTS |
| npm | ≥ 10 |
| Docker Desktop | récent (SQL Server 2022 en conteneur) |

## Démarrage rapide

```bash
# 1. Dépendances
npm ci

# 2. Configuration locale
#    Copier .env.example vers .env.local puis renseigner les valeurs
#    (secrets JWT ≥ 32 caractères, mot de passe SQL fort).
cp .env.example .env.local

# 3. Démarrer SQL Server (conteneur Docker seul, NestJS reste local)
npm run docker:db:up

# 4. Créer les bases locale et de test (idempotent)
npm run db:init

# 5. Appliquer les migrations
npm run migration:run

# 6. Semer les utilisateurs techniques (mots de passe affichés en console)
npm run seed

# 7. Lancer l'API en mode watch
npm run start:dev
```

L'API répond alors sur `http://localhost:3000/api/v1`, Swagger sur `http://localhost:3000/api/docs`.

Pour les tests d'intégration/e2e, créer aussi `.env.test` (copie de `.env.test.example`, même mot de passe SQL que `.env.local`) puis `npm run migration:run:test`.

## Variables d'environnement

Toutes les variables sont **validées au démarrage** : l'application refuse de démarrer si une variable obligatoire manque ou est invalide, avec un message listant précisément les erreurs.

Fichiers : `.env.local`, `.env.development`, `.env.test` (jamais commités ; modèles `*.example` fournis). Détail complet : [docs/configuration.md](docs/configuration.md).

## Connexion SQL Server Management Studio (SSMS)

| Champ | Valeur |
| --- | --- |
| Serveur | `localhost,1433` (ou le port `DB_PORT` configuré) |
| Authentification | SQL Server Authentication |
| Utilisateur | `sa` |
| Mot de passe | valeur de `DB_PASSWORD` dans `.env.local` |
| Chiffrement | Obligatoire (par défaut SSMS 20+) |
| Certificat | **Cocher « Trust server certificate »** (certificat auto-signé du conteneur) |

Bases : `nestjs_starter_local` (développement) et `nestjs_starter_test` (réservée aux tests).

## Comptes de démonstration

`npm run seed` crée deux utilisateurs :

- `admin@local.dev` — Administrateur local
- `user@local.dev` — Utilisateur de démonstration

Les mots de passe proviennent de `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`, ou sont **générés aléatoirement et affichés une seule fois** dans la console du seed.

## Scripts npm

| Script | Rôle |
| --- | --- |
| `start` / `start:dev` / `start:debug` | Démarrage (normal / watch / debug) |
| `build` | Compilation TypeScript |
| `lint` / `lint:fix` | ESLint (contrôle / correction) |
| `format` / `format:check` | Prettier (écriture / contrôle) |
| `test` | Toutes les suites (unit + integration + e2e) |
| `test:unit` | Tests unitaires |
| `test:integration` | Tests d'intégration (base `nestjs_starter_test`) |
| `test:e2e` | Tests end-to-end (Supertest) |
| `test:cov` | Couverture (informative, aucun seuil bloquant) |
| `docker:db:up` / `down` / `restart` | Cycle de vie du conteneur SQL Server |
| `docker:db:logs` / `status` | Logs / état du conteneur |
| `db:init` | Création idempotente des bases locale et test |
| `db:reset:test` | Réinitialisation complète de la base de test |
| `migration:create -- <chemin>` | Squelette de migration vide |
| `migration:generate -- <chemin>` | Migration générée par diff entités/schéma |
| `migration:run` / `revert` / `show` | Exécution / annulation / état des migrations |
| `migration:run:test` | Migrations sur la base de test |
| `seed` / `seed:test` | Données techniques (idempotent) |

Exemples migrations :

```bash
npm run migration:generate -- src/database/migrations/AddSomethingTable
npm run migration:run
npm run migration:show
```

## Endpoints principaux

```text
POST   /api/v1/auth/login          Connexion (publique, 5 req/min/IP)
POST   /api/v1/auth/refresh        Rotation des jetons (cookie, 30 req/min/IP)
POST   /api/v1/auth/logout         Déconnexion de la session courante
POST   /api/v1/auth/logout-all     Déconnexion de toutes les sessions
GET    /api/v1/auth/sessions       Sessions actives de l'utilisateur
DELETE /api/v1/auth/sessions/:id   Révocation d'une session
GET    /api/v1/auth/me             Profil de l'utilisateur connecté

GET    /api/v1/health              Synthèse de santé (publique)
GET    /api/v1/health/live         Liveness (publique)
GET    /api/v1/health/ready        Readiness — vérifie SQL Server (publique)
GET    /metrics                    Métriques Prometheus (hors préfixe /api)

GET    /api/docs                   Swagger UI (si SWAGGER_ENABLED=true)
GET    /api/docs-json              Document OpenAPI JSON
```

Endpoints de démonstration (uniquement si `TECHNICAL_DEMO_ENDPOINTS_ENABLED=true`, JWT requis) :

```text
POST   /api/v1/technical-demo/mail
POST   /api/v1/technical-demo/files
GET    /api/v1/technical-demo/files/:id
DELETE /api/v1/technical-demo/files/:id
GET    /api/v1/technical-demo/pdf
```

## Collection Postman

`postman/` contient la collection complète et l'environnement local. Importer les deux dans Postman, renseigner `userPassword` (affiché par le seed), puis exécuter **Login** : l'access token est enregistré automatiquement, le cookie de refresh token est géré par Postman.

## Architecture

Voir [docs/architecture.md](docs/architecture.md) et l'ADR [0001 — Architecture modulaire pragmatique](docs/adr/0001-modular-clean-architecture.md).

```text
src/
├── common/          Composants transverses (pagination, enveloppe, erreurs, contexte...)
├── config/          Configuration typée et validée
├── database/        DataSource, migrations, seeds, transactions
├── documentation/   Configuration Swagger
└── modules/         users, authentication, audit, health, observability,
                     mail, storage, pdf, scheduler, technical-demo
```

## Documentation

| Document | Sujet |
| --- | --- |
| [docs/getting-started.md](docs/getting-started.md) | Installation pas à pas |
| [docs/configuration.md](docs/configuration.md) | Variables d'environnement |
| [docs/database.md](docs/database.md) | Bases, schéma, SSMS |
| [docs/migrations-and-seeds.md](docs/migrations-and-seeds.md) | Migrations et seeders |
| [docs/authentication.md](docs/authentication.md) | JWT, sessions, rotation, révocation |
| [docs/sso-extension-guide.md](docs/sso-extension-guide.md) | Ajouter un fournisseur SSO |
| [docs/authorization-extension-guide.md](docs/authorization-extension-guide.md) | Ajouter RBAC / permissions |
| [docs/observability.md](docs/observability.md) | Logs, audits, santé, métriques |
| [docs/error-handling.md](docs/error-handling.md) | Format d'erreur et codes stables |
| [docs/testing.md](docs/testing.md) | Stratégie et exécution des tests |
| [docs/create-a-module.md](docs/create-a-module.md) | Créer un nouveau module |
| [docs/mail.md](docs/mail.md) | Module e-mails |
| [docs/file-storage.md](docs/file-storage.md) | Stockage de fichiers |
| [docs/pdf-generation.md](docs/pdf-generation.md) | Génération PDF |
| [docs/scheduled-tasks.md](docs/scheduled-tasks.md) | Tâches planifiées |
| [docs/security.md](docs/security.md) | Mesures de sécurité |

## Résolution des problèmes fréquents

**« Configuration invalide, démarrage refusé »** — une variable manque ou est invalide dans `.env.local` ; le message liste chaque variable en erreur. Comparer avec `.env.example`.

**Le conteneur SQL Server ne démarre pas (port 1433 occupé)** — un autre service SQL Server occupe le port : `docker ps -a` et `Get-NetTCPConnection -LocalPort 1433` pour identifier l'occupant, puis l'arrêter ou changer `DB_PORT`.

**`Login failed for user 'sa'`** — le mot de passe de `.env.local` ne correspond pas à celui utilisé à la PREMIÈRE création du volume. Soit remettre l'ancien mot de passe, soit repartir de zéro : `npm run docker:db:down`, `docker volume rm nestjs-starter-sqlserver-data`, `npm run docker:db:up`, `npm run db:init`, `npm run migration:run`, `npm run seed`.

**Les tests d'intégration échouent immédiatement** — vérifier que `.env.test` existe, que `DB_DATABASE` s'y termine par `_test`, que le conteneur tourne (`npm run docker:db:status`) et que `npm run db:init` a créé la base de test.

**429 Too Many Requests sur /auth/login** — limite volontaire de 5 tentatives/min/IP ; attendre une minute.

**Swagger inaccessible** — vérifier `SWAGGER_ENABLED=true` dans l'environnement courant.
