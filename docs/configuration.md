# Configuration

## Principes

- Configuration **typée** et **validée au démarrage** (class-validator /
  class-transformer) : démarrage refusé si une variable est absente ou
  invalide, avec un message listant précisément les erreurs.
- Accès centralisé : le code applicatif consomme les objets de configuration
  typés (`appConfig`, `authConfig`, `databaseConfig`...) via l'injection —
  jamais `process.env` directement (seules exceptions : `src/config/*.ts`,
  `src/bootstrap-env.ts` et les scripts CLI de `src/database/`).
- Environnements gérés : `local`, `development`, `test`. Le fichier
  `.env.<NODE_ENV>` prime sur `.env`.

## Variables

### Application

| Variable | Exemple | Description |
| --- | --- | --- |
| `NODE_ENV` | `local` | `local`, `development` ou `test` |
| `APP_NAME` | `nestjs-enterprise-starter` | Nom affiché (logs, Swagger) |
| `APP_HOST` | `0.0.0.0` | Interface d'écoute |
| `APP_PORT` | `3000` | Port HTTP |
| `APP_GLOBAL_PREFIX` | `api` | Préfixe global des routes |
| `APP_VERSION` | `1` | Version d'URI (`/api/v1/...`) |
| `APP_CORS_ORIGINS` | `http://localhost:5173` | Origines autorisées, séparées par des virgules |

### Base de données

| Variable | Description |
| --- | --- |
| `DB_HOST` / `DB_PORT` | Hôte / port SQL Server |
| `DB_USERNAME` / `DB_PASSWORD` | Identifiants (aussi utilisés par docker-compose) |
| `DB_DATABASE` | Base de l'environnement courant |
| `DB_TEST_DATABASE` | Base réservée aux tests (doit finir par `_test`) |
| `DB_ENCRYPT` | `true` : chiffrement de la connexion |
| `DB_TRUST_SERVER_CERTIFICATE` | `true` en local (certificat auto-signé) |

### JWT et cookie

| Variable | Description |
| --- | --- |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Secrets DISTINCTS, ≥ 32 caractères |
| `JWT_ACCESS_EXPIRATION` | Durée courte, ex. `15m` |
| `JWT_REFRESH_EXPIRATION` | Durée longue, ex. `7d` |
| `REFRESH_COOKIE_NAME` | Nom du cookie (`refresh_token`) |
| `REFRESH_COOKIE_SECURE` | `true` dès que HTTPS disponible |
| `REFRESH_COOKIE_SAME_SITE` | `lax`, `strict` ou `none` |
| `REFRESH_COOKIE_DOMAIN` | Vide en local |

### Fonctionnalités et observabilité

| Variable | Description |
| --- | --- |
| `LOG_LEVEL` | `fatal`…`trace` (niveau Pino) |
| `SWAGGER_ENABLED` | Active /api/docs |
| `METRICS_ENABLED` | Active /metrics |
| `SCHEDULER_ENABLED` | Active les tâches planifiées |
| `TECHNICAL_DEMO_ENDPOINTS_ENABLED` | Enregistre les routes /technical-demo |

### E-mails

| Variable | Description |
| --- | --- |
| `MAIL_DRIVER` | `development` (journalisation) ou `smtp` (envoi réel) |
| `MAIL_HOST` / `MAIL_PORT` | Serveur SMTP |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Facultatifs |
| `MAIL_FROM` | Expéditeur par défaut |

### Stockage de fichiers

| Variable | Description |
| --- | --- |
| `STORAGE_DRIVER` | `local` (seul pilote de cette version) |
| `STORAGE_LOCAL_PATH` | Répertoire de stockage (créé automatiquement) |
| `STORAGE_MAX_FILE_SIZE` | Taille max en octets |
| `STORAGE_ALLOWED_MIME_TYPES` | Types MIME autorisés, séparés par des virgules |

### Seeder (facultatif)

`SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD` : mots de passe des comptes semés ;
à défaut, génération aléatoire affichée en console.

## Ajouter une variable

1. déclarer et valider dans `src/config/environment.validation.ts` ;
2. l'exposer dans la configuration typée du domaine concerné
   (`registerAs`) — ou créer un nouveau fichier `*.config.ts` enregistré dans
   `ConfigurationModule` ;
3. documenter dans les 4 fichiers `.env*.example` et dans ce guide ;
4. compléter le test `environment.validation.spec.ts`.
