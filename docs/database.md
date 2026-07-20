# Base de données

## Instance et bases

SQL Server 2022 s'exécute dans un conteneur Docker dédié
(`nestjs-starter-sqlserver`) ; NestJS s'exécute localement. Une même instance
héberge deux bases :

| Base | Usage |
| --- | --- |
| `nestjs_starter_local` | Développement local |
| `nestjs_starter_test` | Tests d'intégration et e2e UNIQUEMENT |

`npm run db:init` crée les deux bases (idempotent).
`npm run db:reset:test` détruit puis recrée la base de test — garde-fou : le
script refuse toute base dont le nom ne finit pas par `_test`.

## Docker

- volume nommé `nestjs-starter-sqlserver-data` : les données survivent aux
  redémarrages ;
- healthcheck sqlcmd (via `127.0.0.1` : `localhost` se résout en IPv6 dans le
  conteneur et ferait échouer la sonde) ;
- `Dockerfile.dev` est fourni à titre de référence UNIQUEMENT : le
  docker-compose local ne conteneurise jamais NestJS.

## Schéma

| Table | Rôle |
| --- | --- |
| `users` | Utilisateurs techniques (auth locale, futur lien SSO) |
| `auth_sessions` | Sessions / refresh tokens (empreintes SHA-256, familles) |
| `audit_logs` | Journal d'audit immuable |
| `typeorm_migrations` | Suivi technique des migrations |

Conventions : UUID `uniqueidentifier` (défaut `NEWSEQUENTIALID()`), dates
`datetime2` interprétées en UTC, soft delete (`deleted_at`) sur les entités
modifiables, noms de tables/colonnes en `snake_case` anglais.

Classes de base TypeORM (`src/common/entities/`) :

- `AuditableEntity` : id, created_at, updated_at, deleted_at, created_by,
  updated_by (UUID nullable, sans relation imposée vers `users`) ;
- `ImmutableEntity` : id, created_at — pour les données jamais modifiées
  (audit logs).

## TypeORM

- `synchronize: false` — définitif ; le schéma n'évolue QUE par migrations ;
- l'application utilise `autoLoadEntities` : chaque module déclare ses entités
  via `TypeOrmModule.forFeature` ;
- la CLI utilise `src/database/data-source.ts` (mêmes variables d'environnement
  que l'application) ;
- transactions : `TransactionService.execute(work)` encapsule
  `DataSource.transaction` — commit en fin normale, rollback sur exception ;
- pas de repository générique universel : les modules écrivent leurs requêtes
  spécifiques (QueryBuilder autorisé), avec les helpers de pagination/filtres
  du socle pour les listes.

## Connexion SSMS

| Champ | Valeur |
| --- | --- |
| Server name | `localhost,1433` |
| Authentication | SQL Server Authentication |
| Login | `sa` |
| Password | `DB_PASSWORD` de `.env.local` |
| Encryption | Mandatory |
| Trust server certificate | ✅ à cocher (certificat auto-signé) |
