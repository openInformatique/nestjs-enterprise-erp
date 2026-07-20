# Plongée dans l'architecture — nestjs-enterprise-starter

> Document destiné à un développeur Angular/Node.js confirmé souhaitant comprendre en profondeur
> ce projet NestJS : son architecture, ses patterns, ses choix techniques et le rôle de chaque pièce.

---

## Table des matières

1. [Contexte et objectif du projet](#1-contexte-et-objectif-du-projet)
2. [Stack technique — pourquoi ces choix ?](#2-stack-technique--pourquoi-ces-choix-)
3. [NestJS — les concepts fondamentaux](#3-nestjs--les-concepts-fondamentaux)
4. [L'architecture Clean / hexagonale](#4-larchitecture-clean--hexagonale)
5. [Structure générale du projet](#5-structure-générale-du-projet)
6. [Analyse dossier par dossier](#6-analyse-dossier-par-dossier)
   - [src/main.ts et bootstrap](#srcmaints-et-bootstrap)
   - [src/config/](#srcconfig)
   - [src/common/](#srccommon)
   - [src/database/](#srcdatabase)
   - [src/modules/users/](#srcmodulesusers)
   - [src/modules/authentication/](#srcmodulesauthentication)
   - [src/modules/audit/](#srcmodulesaudit)
   - [src/modules/health/](#srcmoduleshealth)
   - [src/modules/mail/](#srcmodulesmail)
   - [src/modules/storage/](#srcmodulesstorage)
   - [src/modules/pdf/](#srcmodulespdf)
   - [src/modules/scheduler/](#srcmodulesscheduler)
   - [src/modules/observability/](#srcmodulesobservability)
   - [src/modules/technical-demo/](#srcmodulestechnical-demo)
7. [Flux d'une requête HTTP de bout en bout](#7-flux-dune-requête-http-de-bout-en-bout)
8. [Authentification — mécanique détaillée](#8-authentification--mécanique-détaillée)
9. [Gestion des erreurs](#9-gestion-des-erreurs)
10. [Tests — organisation et stratégie](#10-tests--organisation-et-stratégie)
11. [Notions clés à maîtriser](#11-notions-clés-à-maîtriser)
12. [Comment étendre le projet](#12-comment-étendre-le-projet)

---

## 1. Contexte et objectif du projet

Ce dépôt est un **socle technique d'entreprise**, c'est-à-dire un point de départ réutilisable pour construire des API NestJS. Il n'implémente aucune logique métier (pas de clients, commandes, produits) mais fournit en revanche toutes les briques transversales :

- Authentification JWT avec sessions persistantes et rotation des refresh tokens
- Journal d'audit en base
- Logging structuré
- Gestion standardisée des erreurs
- Pagination, filtres, tri
- Health checks, métriques Prometheus
- Envoi d'e-mails, stockage de fichiers, génération de PDF
- Tâches planifiées

L'idée est simple : quand un développeur démarre un nouveau projet, il clone ce dépôt et il a déjà tout le "plomberie" en place. Il n'a qu'à créer ses propres modules métier en suivant les patterns établis.

---

## 2. Stack technique — pourquoi ces choix ?

### NestJS 11

NestJS est un framework opinionné construit au-dessus d'Express (ou Fastify). Il apporte ce qu'Express n'a pas : un système de modules, l'injection de dépendances, les décorateurs, une structure claire. Si tu viens d'Angular, tu retrouveras des concepts quasi identiques (modules, services, décorateurs, DI).

La différence fondamentale avec un serveur Express classique :

```
Express : tu assembles toi-même middleware, routes, validation, etc.
NestJS  : tout est structuré, injecté, déclaré explicitement.
```

### TypeORM avec SQL Server

TypeORM est l'ORM retenu. Le pilote `mssql` permet de se connecter à Microsoft SQL Server. La règle absolue du projet : **`synchronize: false`**. Cela signifie que TypeORM ne modifie jamais le schéma automatiquement. Toute évolution de base passe par des **migrations** explicites. C'est la seule approche sûre en environnement d'entreprise.

### Argon2id pour les mots de passe

C'est l'algorithme recommandé en 2024-2026 pour le hachage de mots de passe (vainqueur du Password Hashing Competition). Il est résistant aux attaques GPU/ASIC. Ne pas utiliser bcrypt (trop rapide) ni MD5/SHA-256 (pas conçus pour les mots de passe).

### Pino pour les logs

Pino est l'une des bibliothèques de logging Node.js les plus rapides. Elle produit des logs JSON structurés, ce qui les rend lisibles par Loki, Elasticsearch, Datadog, etc. La bibliothèque `nestjs-pino` intègre Pino dans le cycle de vie NestJS.

### JWT (access + refresh)

Deux tokens distincts :
- L'**access token** est un JWT court (15 min), transmis dans `Authorization: Bearer`. Il est stateless : le serveur n'a pas besoin de base de données pour le valider.
- Le **refresh token** est long (7 jours), stocké dans un cookie HttpOnly. Il sert uniquement à obtenir un nouvel access token. En base, on ne stocke jamais le token brut, seulement son empreinte SHA-256.

---

## 3. NestJS — les concepts fondamentaux

Si tu viens d'Angular, cette section sera rapide. Les parallèles sont directs.

### Modules

Un module NestJS (`@Module()`) est un conteneur qui regroupe des providers, contrôleurs et imports liés. Ils fonctionnent exactement comme les modules Angular.

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [TypeOrmUserRepository, GetUserByIdUseCase],
  exports: [GetUserByIdUseCase],
})
export class UsersModule {}
```

- `imports` : autres modules dont on a besoin
- `providers` : services/repositories/use-cases disponibles dans ce module
- `exports` : ce que les autres modules peuvent utiliser
- `controllers` : contrôleurs HTTP du module

### Injection de dépendances

Même principe qu'Angular. NestJS instancie les classes et injecte les dépendances via le constructeur.

```typescript
@Injectable()
export class LoginUseCase {
  constructor(
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}
}
```

La différence notable avec Angular : quand on injecte une **interface** (pas une classe concrète), on ne peut pas utiliser directement le type comme token d'injection (TypeScript efface les types à la compilation). On utilise un **Symbol** comme token :

```typescript
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

// Dans le module :
{ provide: USER_REPOSITORY, useClass: TypeOrmUserRepository }

// Dans le constructeur :
@Inject(USER_REPOSITORY)
private readonly userRepository: UserRepositoryPort
```

### Décorateurs

NestJS est entièrement basé sur les décorateurs TypeScript. Les principaux :

| Décorateur | Rôle |
|---|---|
| `@Module()` | Déclare un module |
| `@Injectable()` | Rend une classe injectable |
| `@Controller()` | Déclare un contrôleur REST |
| `@Get()`, `@Post()`, etc. | Déclare une route HTTP |
| `@Body()` | Extrait le corps de la requête |
| `@Param()` | Extrait un paramètre de route |
| `@Query()` | Extrait un query parameter |
| `@UseGuards()` | Applique un guard sur une route |
| `@UseInterceptors()` | Applique un interceptor |
| `@Catch()` | Déclare un filtre d'exception |

### Guards

Un guard décide si une requête peut continuer ou non. C'est l'équivalent des `CanActivate` en Angular. Dans ce projet, `JwtAuthGuard` est appliqué **globalement** : toutes les routes nécessitent un JWT valide, sauf celles décorées `@Public()`.

```typescript
// Route publique → le guard la laisse passer sans token
@Public()
@Post('login')
async login(...) {}

// Route protégée → le guard exige un JWT valide Bearer
@Get('me')
async me(@CurrentUser() user: AuthenticatedUser) {}
```

### Interceptors

Un interceptor entoure l'exécution d'un handler. Il peut transformer la réponse avant qu'elle soit renvoyée. Dans ce projet, `ResponseEnvelopeInterceptor` enveloppe toutes les réponses dans `{ success: true, data: ..., meta: {...} }`.

### Pipes

Un pipe transforme ou valide les données entrantes. Le `ValidationPipe` global utilise `class-validator` pour valider automatiquement tous les DTO. Si un champ est invalide, la requête est refusée avant même d'atteindre le contrôleur.

### Filters (Exception Filters)

Un filtre d'exception attrape les erreurs non gérées et les transforme en réponses HTTP structurées. `GlobalExceptionFilter` attrape tout, convertit les `AppException` en JSON standardisé, et empêche les stacktraces SQL de fuiter vers le client.

### Middleware

Un middleware s'exécute avant les guards et interceptors. `RequestContextMiddleware` est le premier élément de la chaîne : il lit ou génère le `x-request-id` et ouvre le contexte `AsyncLocalStorage` pour la requête courante.

---

## 4. L'architecture Clean / hexagonale

Le principe central : **les couches internes n'ont aucune connaissance des couches externes**.

```
┌─────────────────────────────────────────┐
│           PRESENTATION                  │  ← Contrôleurs, DTOs HTTP, Guards
│    (dépend de application)              │
├─────────────────────────────────────────┤
│           APPLICATION                   │  ← Use cases, orchestration
│    (dépend de domain)                   │
├─────────────────────────────────────────┤
│              DOMAIN                     │  ← Entités métier, interfaces
│    (aucune dépendance externe)          │
└─────────────────────────────────────────┘
         ▲           ▲
         │           │
┌────────┴───────────┴────────────────────┐
│           INFRASTRUCTURE                │  ← TypeORM, SMTP, système de fichiers
│    (implémente les contrats du domaine) │
└─────────────────────────────────────────┘
```

### Pourquoi ce découpage ?

Prenons le module `users` comme exemple :

**Domain** — `user-repository.port.ts` :
```typescript
// Interface pure, aucune dépendance NestJS/TypeORM
export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updateLastLoginAt(id: string, date: Date): Promise<void>;
}
```

**Infrastructure** — `typeorm-user.repository.ts` :
```typescript
// Implémentation concrète avec TypeORM, inconnue du domaine
@Injectable()
export class TypeOrmUserRepository implements UserRepositoryPort {
  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? UserMapper.toDomain(entity) : null;
  }
}
```

**Application** — `login.use-case.ts` :
```typescript
// Ne connaît que l'interface, pas TypeORM
constructor(
  @Inject(USER_REPOSITORY)
  private readonly userRepository: UserRepositoryPort, // ← interface
) {}
```

**Ce que ça permet** : si demain on remplace SQL Server par PostgreSQL, on écrit une nouvelle implémentation de `UserRepositoryPort`, on l'injecte dans le module, et le cas d'utilisation ne change pas d'une ligne.

### Le mapper

Le mapper est le pont entre l'entité TypeORM (représentation base de données) et l'entité de domaine (représentation métier pure). Ces deux objets sont délibérément séparés car ils ont des responsabilités différentes.

```typescript
// Entité TypeORM : décrit la table SQL
@Entity('users')
class UserEntity extends AuditableEntity {
  @Column({ unique: true })
  email: string;
}

// Entité domaine : représente le concept métier
class User {
  canAuthenticateLocally(): boolean { ... }
}

// Mapper : traduit l'un en l'autre
class UserMapper {
  static toDomain(entity: UserEntity): User { ... }
  static toEntity(domain: User): UserEntity { ... }
}
```

---

## 5. Structure générale du projet

```
nestjs-enterprise-starter/
│
├── src/                     # Code source de l'application
│   ├── main.ts              # Point d'entrée Node.js
│   ├── app.module.ts        # Module racine
│   ├── app.setup.ts         # Configuration globale (Helmet, CORS, pipes...)
│   ├── bootstrap-env.ts     # Chargement de l'environnement avant tout
│   │
│   ├── config/              # Configuration typée et validée
│   ├── common/              # Briques transversales réutilisables
│   ├── database/            # TypeORM, migrations, seeds, transactions
│   └── modules/             # Modules fonctionnels du socle
│
├── test/                    # Tests (intégration et e2e séparés du src)
│
├── docker-compose.yml       # SQL Server uniquement
├── Dockerfile.dev           # Référence (non utilisé par compose)
├── .env.*.example           # Templates de configuration par environnement
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 6. Analyse dossier par dossier

### `src/main.ts` et bootstrap

**`bootstrap-env.ts`** s'exécute **en premier**, avant même que NestJS ne charge quoi que ce soit. Il appelle `dotenv.config()` pour charger le fichier `.env.*` correspondant à `NODE_ENV`. C'est critique car les décorateurs TypeORM lisent `process.env` au moment de la déclaration du module.

**`main.ts`** bootstrappe l'application NestJS :
1. Crée l'instance NestJS avec `NestFactory.create()`
2. Branche le logger Pino
3. Appelle `configureApp()` (défini dans `app.setup.ts`) pour configurer Helmet, CORS, pipes, filtres, interceptors
4. Active Swagger si activé
5. Écoute sur le port configuré

**`app.setup.ts`** centralise toute la configuration globale en dehors de `main.ts` pour être testable :
- `app.use(helmet())` — headers de sécurité HTTP
- `app.use(cookieParser())` — parsing des cookies (nécessaire pour le refresh token)
- `app.enableCors(...)` — CORS avec liste blanche
- `app.setGlobalPrefix('/api')` — préfixe de toutes les routes
- `app.enableVersioning({ type: URI, defaultVersion: '1' })` — versionnement `/v1/`
- `app.useGlobalPipes(new GlobalValidationPipe())` — validation automatique de tous les DTO
- `app.useGlobalFilters(new GlobalExceptionFilter(...))` — gestion globale des erreurs
- `app.useGlobalInterceptors(new ResponseEnvelopeInterceptor(...))` — enveloppe des réponses

---

### `src/config/`

Ce dossier centralise la configuration. Chaque fichier correspond à un domaine de configuration.

#### `environment.validation.ts`

C'est la pièce la plus importante de ce dossier. Elle définit une classe `EnvironmentVariables` avec toutes les variables d'environnement attendues, décorées avec `class-validator` :

```typescript
export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment;

  @IsInt()
  @Min(1)
  @Max(65535)
  APP_PORT: number;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;
  // ...
}
```

Au démarrage, NestJS valide les variables via cette classe. Si `JWT_ACCESS_SECRET` est absent ou trop court, l'application **refuse de démarrer** avec un message explicite. C'est fondamental pour la sécurité : on ne découvre pas qu'une variable manque en production.

#### Les fichiers `*.config.ts`

Chaque fichier utilise `registerAs()` de `@nestjs/config`. Cela crée un **namespace de configuration** typé :

```typescript
// auth.config.ts
export const authConfig = registerAs('auth', (): AuthConfig => ({
  accessTokenSecret: process.env.JWT_ACCESS_SECRET as string,
  accessTokenExpiration: process.env.JWT_ACCESS_EXPIRATION as string,
  // ...
}));
```

Dans un service, on injecte cette configuration typée :

```typescript
constructor(
  @Inject(authConfig.KEY)
  private readonly config: ConfigType<typeof authConfig>,
) {}
// config.accessTokenSecret est typé string, pas process.env.JWT_ACCESS_SECRET
```

**Avantage crucial** : aucun `process.env.XYZ` dispersé dans le code. Tout passe par ces objets typés, validés au démarrage.

---

### `src/common/`

Tout ce qui est partagé entre les modules. Rien ici n'est fonctionnel (pas de logique métier), tout est technique.

#### `context/` — Le contexte de requête

C'est l'une des pièces les plus intelligentes du socle. Le problème à résoudre : comment un service d'audit (appelé au fond de la chaîne d'appel) peut-il connaître le `requestId` de la requête en cours, sans que ce `requestId` soit passé en paramètre à chaque méthode ?

La réponse : `AsyncLocalStorage`, une API Node.js native qui permet de stocker des données **localement à une chaîne d'exécution asynchrone**. C'est l'équivalent des thread-locals en Java.

```typescript
// Au début de la requête (middleware) :
contextService.run({ requestId: 'uuid-123', ipAddress: '1.2.3.4' }, () => {
  // Tout le traitement de cette requête se passe ici
});

// N'importe où dans la chaîne d'appel, même dans AuditService :
const context = contextService.get();
console.log(context.requestId); // 'uuid-123' — sans avoir été passé en paramètre
```

Le `RequestContextMiddleware` ouvre ce contexte au tout début. Le `JwtAuthGuard` l'enrichit avec `userId` et `sessionId` une fois le JWT validé.

#### `decorators/`

Quatre décorateurs custom :

- **`@Public()`** — marque une route comme publique. Le guard JWT lit cette métadonnée et skip la vérification.
- **`@CurrentUser()`** — injecte l'objet `AuthenticatedUser` depuis `request.user` (que le guard JWT y a placé).
- **`@SkipResponseEnvelope()`** — dit à l'interceptor de ne pas envelopper la réponse (utilisé pour les téléchargements de fichiers, les métriques Prometheus).
- **`@RequiresPermission()`** — déclare une exigence d'autorisation (métadonnée stockée, pas encore appliquée — le guard RBAC futur la lira).

#### `exceptions/`

Hiérarchie d'exceptions :

```
Error
  └── HttpException (NestJS)
        └── AppException (base custom, ajoute `code` et `details`)
              ├── ValidationException
              ├── AuthenticationFailedException
              ├── AccessTokenInvalidException
              ├── RefreshTokenInvalidException
              ├── SessionExpiredException
              ├── SessionRevokedException
              ├── RefreshTokenReuseDetectedException
              ├── ResourceNotFoundException
              ├── ResourceAlreadyExistsException
              ├── FileNotFoundException
              ├── FileTypeNotAllowedException
              └── FileTooLargeException
```

Chaque exception a un **code technique stable** (`ErrorCode.AuthenticationFailed`) et un **message en français** par défaut. Le `GlobalExceptionFilter` mappe ces exceptions vers le format de réponse standardisé.

#### `filters/global-exception.filter.ts`

Ce filtre attrape **toutes** les exceptions non gérées, quelle que soit leur nature :

1. `AppException` → code technique + message français déjà formatés
2. `HttpException` NestJS (ex: 404 généré par NestJS lui-même) → converti au format standard
3. `QueryFailedError` TypeORM (violation de contrainte SQL) → `RESOURCE_ALREADY_EXISTS` ou `DATABASE_ERROR`, sans jamais exposer le SQL
4. `EntityNotFoundError` TypeORM → `RESOURCE_NOT_FOUND`
5. Tout le reste → `INTERNAL_SERVER_ERROR` générique

La stacktrace est loggée mais **jamais renvoyée au client**, sauf en mode `local`.

#### `interceptors/response-envelope.interceptor.ts`

Toutes les réponses réussies sont encapsulées :

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-07-14T10:00:00.000Z"
  }
}
```

Pour les réponses paginées (instances de `PaginatedResult`), l'interceptor détecte automatiquement et ajoute `meta.pagination`.

L'interceptor **ne s'applique pas** aux :
- Réponses `204 No Content`
- `StreamableFile` et `Buffer` (téléchargements)
- Routes décorées `@SkipResponseEnvelope()`

#### `pagination/`

Ensemble de composants réutilisables pour toute liste paginée :

- `PaginationQueryDto` — DTO de requête avec `page`, `limit`, `sortBy`, `sortDirection`, `search`. Chaque module étend ce DTO pour ajouter ses propres filtres.
- `PaginationMetaDto` — Métadonnées de pagination calculées : `totalItems`, `totalPages`, `hasNextPage`, etc.
- `PaginatedResult<T>` — Interface `{ items: T[], meta: PaginationMetaDto }` retournée par les repositories.
- `TypeOrmPaginationHelper` — Applique `skip`/`take` à un `QueryBuilder`.
- `TypeOrmFilterHelper` — Applique des filtres à un `QueryBuilder` avec une **liste blanche de colonnes autorisées** (protection contre l'injection SQL via les paramètres de tri/filtre).

Exemple d'utilisation dans un futur module :

```typescript
const result = await this.repo
  .createQueryBuilder('user')
  .where('user.deletedAt IS NULL');

// Applique tri et pagination de manière sécurisée
TypeOrmFilterHelper.applySort(qb, query, ['email', 'createdAt']); // whitelist
TypeOrmPaginationHelper.apply(qb, query);

const [items, total] = await qb.getManyAndCount();
```

#### `entities/`

Deux classes de base pour les entités TypeORM :

- **`AuditableEntity`** — Pour toute entité modifiable. Fournit `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (soft delete via `@DeleteDateColumn`), `createdBy`, `updatedBy`.
- **`ImmutableEntity`** — Pour les entités en écriture seule (audit logs). Fournit uniquement `id` et `createdAt`. Pas de `updatedAt` car ces entités ne sont jamais modifiées.

#### `security/throttling.module.ts`

Configure le rate limiting global avec `@nestjs/throttler` :
- Limite par défaut : 100 requêtes / minute
- En environnement de test : 10 000 / minute (pour ne pas bloquer les tests)
- Sur `POST /auth/login` : 5 / minute (anti-brute force)
- Sur `POST /auth/refresh` : 30 / minute

Ces limites sont définies comme constantes exportées et utilisées directement dans le contrôleur avec `@Throttle({ default: { ttl: ..., limit: ... } })`.

---

### `src/database/`

#### `data-source.ts`

Le fichier DataSource pour la CLI TypeORM. Lorsqu'on exécute `npm run migration:generate`, TypeORM a besoin d'un fichier de configuration à part (pas le module NestJS complet, juste la connexion). Ce fichier charge l'environnement, instancie un `DataSource` et l'exporte pour la CLI.

#### `database.module.ts`

Le module NestJS qui configure TypeORM pour l'application. Il utilise `TypeOrmModule.forRootAsync()` pour injecter la configuration depuis `ConfigService` :

```typescript
TypeOrmModule.forRootAsync({
  inject: [databaseConfig.KEY],
  useFactory: (config: DatabaseConfig) => ({
    type: 'mssql',
    host: config.host,
    synchronize: false, // JAMAIS en production
    autoLoadEntities: true, // Charge les entités déclarées dans les modules
  }),
})
```

#### `migrations/`

Trois migrations nommées explicitement :
1. `CreateUsersTable` — Crée la table `users` avec tous les index.
2. `CreateAuthSessionsTable` — Crée `auth_sessions` avec FK vers `users`, index sur `token_family_id`, `expires_at`, `revoked_at`.
3. `CreateAuditLogsTable` — Crée `audit_logs` en lecture seule (pas de PK modifiable, pas de `updatedAt`).

Chaque migration a une méthode `up()` (applique) et `down()` (annule). TypeORM suit les migrations appliquées dans une table `migrations`.

#### `transaction/transaction.service.ts`

Un wrapper très léger autour de `DataSource.transaction()` :

```typescript
await transactionService.execute(async (manager: EntityManager) => {
  await manager.save(entityA);
  await manager.save(entityB);
  // Si entityB plante, entityA est rollback automatiquement
});
```

L'avantage : les repositories qui reçoivent un `EntityManager` transactionnel n'ont pas besoin de savoir qu'ils sont dans une transaction.

#### `seeds/`

Le seeder crée deux utilisateurs de développement (`admin@local.dev`, `user@local.dev`) avec des mots de passe Argon2. Il est **idempotent** : si l'utilisateur existe déjà, il ne fait rien. Les mots de passe viennent des variables `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`, ou sont générés aléatoirement et affichés en console.

---

### `src/modules/users/`

Ce module gère les utilisateurs techniques. Il n'expose pas de contrôleur public (pas de CRUD `GET /users` dans cette version du socle).

#### `domain/user.ts`

La classe `User` est une **entité de domaine pure** : aucune dépendance à NestJS ou TypeORM. Elle encapsule les règles métier :

```typescript
canAuthenticateLocally(): boolean {
  return (
    this.isActive &&
    this.deletedAt === null &&
    this.passwordHash !== null &&
    this.authenticationSource === AuthenticationSource.Local
  );
}
```

Cette logique est testable sans base de données ni framework.

La fonction `normalizeEmail()` est une règle de domaine : elle s'applique avant toute recherche ou écriture. Cela garantit que `User@Example.COM` et `user@example.com` sont le même utilisateur.

#### `domain/user-repository.port.ts`

L'interface que le domaine utilise pour accéder aux données. Elle ne mentionne pas SQL Server, TypeORM, ou quoi que ce soit d'infrastructure. Elle dit juste : "j'ai besoin de pouvoir faire ça".

#### `infrastructure/entities/user.entity.ts`

L'entité TypeORM mappée sur la table `users`. Elle étend `AuditableEntity` qui apporte les colonnes techniques (UUID, timestamps, soft delete). Elle connaît TypeORM mais pas les règles métier.

#### `infrastructure/user.mapper.ts`

Le pont entre `UserEntity` (TypeORM) et `User` (domaine). Important : le domaine ne reçoit jamais un objet TypeORM directement.

---

### `src/modules/authentication/`

Le module le plus complexe du socle. Voyons sa mécanique en détail.

#### `domain/auth-session.ts`

La classe `AuthSession` représente une session en cours. Ses méthodes de domaine :
- `isRevoked()` → true si `revokedAt !== null`
- `isExpired()` → true si `expiresAt` est dépassé
- `isUsable()` → non révoquée ET non expirée

L'enum `SessionRevocationReason` documente les raisons de révocation : `LOGOUT`, `LOGOUT_ALL`, `REVOKED_BY_USER`, `TOKEN_REUSE_DETECTED`.

#### `domain/identity-provider.port.ts`

Le contrat SSO. C'est ici que réside la préparation pour le futur fournisseur d'identité (Entra ID, Kerberos, OpenID Connect...). L'union `AuthenticationInput = LocalAuthenticationInput | ExternalAuthenticationInput` permet d'accepter n'importe quel type d'identité.

```typescript
export interface IdentityProviderPort {
  authenticate(input: AuthenticationInput): Promise<AuthenticatedIdentity>;
}
```

Aujourd'hui, seul `LocalIdentityProvider` implémente ce contrat. Demain, on ajoute `EntraIdIdentityProvider` sans toucher aux use cases.

#### `infrastructure/local-identity.provider.ts`

Implémentation locale. Point de sécurité crucial : **la protection contre le timing attack**.

```typescript
// Si l'utilisateur n'existe pas, on exécute QUAND MÊME une vérification de hash
// avec un hash factice. Sans ça, un attaquant pourrait mesurer le temps de réponse
// pour déterminer si un e-mail existe dans la base.
const hashToVerify = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
const isValid = await this.passwordHasher.verify(hashToVerify, password);
if (!user || !isValid) {
  throw new AuthenticationFailedException();
}
```

#### `application/token.service.ts`

Génère et vérifie les JWT. Points notables :
- **Access token** : signé avec `JWT_ACCESS_SECRET`, contient `sub` (userId), `sid` (sessionId), `jti` (UUID unique du token).
- **Refresh token** : signé avec `JWT_REFRESH_SECRET` **différent**, stocké dans un cookie HttpOnly.
- `hashRefreshToken()` : SHA-256 du token brut. C'est cet hash qu'on stocke en base. Si la base est compromise, les tokens ne sont pas récupérables.

#### `application/refresh-tokens.use-case.ts`

La mécanique la plus sensible du système. À chaque refresh :

1. Vérifie la signature JWT du refresh token
2. Retrouve la session via le claim `sid`
3. **Détection de réutilisation** : compare le hash du token reçu avec celui en base. Si différents → compromission détectée → révocation de toute la famille → audit de sécurité
4. Vérifie que la session n'est pas révoquée et pas expirée
5. Génère un nouveau refresh token, remplace l'hash en base
6. Renvoie un nouvel access token

La notion de **token family** : quand un utilisateur se connecte, un `tokenFamilyId` est créé. À chaque rotation, la session garde le même `tokenFamilyId`. Si un ancien token de la famille est réutilisé, TOUTE la famille est révoquée, ce qui force une reconnexion même sur d'autres appareils légitimes.

#### `presentation/jwt-auth.guard.ts`

Guard global appliqué à toutes les routes. Voici ce qu'il fait :

1. Vérifie si la route est `@Public()` → skip
2. Extrait le token de `Authorization: Bearer <token>`
3. Vérifie la signature et l'expiration du JWT
4. Enrichit `request.user` avec `{ userId, sessionId }`
5. Enrichit le contexte AsyncLocalStorage avec `userId` et `sessionId` (pour les logs et audits)
6. Si le token est absent ou invalide → `AccessTokenInvalidException`

**Important** : le guard ne vérifie pas la session en base. C'est délibéré. Un access token valide donne accès même si la session a été révoquée entre-temps (jusqu'à l'expiration du token, typiquement 15 min). C'est un compromis standard entre performance et sécurité. Pour invalider immédiatement, il faudrait vérifier la session à chaque requête (ajout futur documenté).

#### `presentation/refresh-cookie.service.ts`

Gère le cookie HttpOnly du refresh token. Le cookie est configuré avec :
- `httpOnly: true` → inaccessible au JavaScript frontend (protection XSS)
- `secure: true/false` selon l'environnement
- `sameSite: 'strict'/'lax'` → protection CSRF
- `path: '/api/v1/auth'` → le cookie n'est envoyé QUE vers les routes d'authentification

---

### `src/modules/audit/`

Ce module distingue deux choses souvent confondues :
- **Logs Pino** : diagnostic technique, rotation des fichiers, collecte par Loki/Elasticsearch
- **Audit logs** : trace persistante en base de données des événements importants

#### `application/audit.service.ts`

Le service `AuditService` est conçu pour être utilisé partout :

```typescript
await this.auditService.record({
  category: AuditCategory.Security,
  action: 'auth.login.success',
  actorUserId: userId,
  resourceType: 'auth_session',
  resourceId: sessionId,
  metadata: { source: 'local' }, // données supplémentaires contextuelles
});
```

Il enrichit automatiquement l'entrée avec le `requestId`, l'IP et le user-agent du contexte AsyncLocalStorage.

**Protection des données sensibles** : avant d'insérer, le service filtre les clés connues (`password`, `accessToken`, `refreshToken`, `refreshTokenHash`, etc.) des métadonnées. Un développeur ne peut pas accidentellement logger un token.

**Résilience** : si l'insertion en base échoue, le service **logge l'erreur mais ne la propage pas**. Un audit raté ne doit jamais faire planter la requête principale.

---

### `src/modules/health/`

Utilise `@nestjs/terminus`, le module officiel de health checks.

Trois endpoints publics :

| Endpoint | Rôle |
|---|---|
| `GET /api/v1/health/live` | Le processus répond-il ? (Kubernetes liveness probe) |
| `GET /api/v1/health/ready` | L'application est-elle prête à recevoir du trafic ? Vérifie la connexion SQL Server. |
| `GET /api/v1/health` | Synthèse complète |

Ces endpoints ne sont **pas** enveloppés dans la réponse standard (Terminus a son propre format JSON).

---

### `src/modules/mail/`

Illustration parfaite du pattern ports & adapters.

#### `domain/mail-provider.port.ts`

Le contrat. Ce que le domaine attend, sans savoir comment c'est implémenté :

```typescript
export interface MailProviderPort {
  send(message: MailMessage): Promise<MailDeliveryResult>;
}
```

#### `infrastructure/development-mail.provider.ts`

En développement (`MAIL_DRIVER=log`), les e-mails ne sont pas envoyés. Le service logge les métadonnées (destinataire, sujet) sans jamais logger le contenu du message (qui pourrait contenir des données personnelles).

#### `infrastructure/smtp-mail.provider.ts`

En production (`MAIL_DRIVER=smtp`), utilise Nodemailer avec un timeout de 10 secondes.

Le `MailModule` sélectionne l'implémentation selon la configuration :
```typescript
{
  provide: MAIL_PROVIDER,
  useFactory: (config) =>
    config.driver === MailDriver.Smtp
      ? new SmtpMailProvider(config)
      : new DevelopmentMailProvider(logger),
  inject: [mailConfig.KEY],
}
```

---

### `src/modules/storage/`

Même pattern. `FileStoragePort` est l'interface ; `LocalFileStorageService` est l'implémentation locale.

#### Points de sécurité de `LocalFileStorageService`

1. **Path traversal** : Le nom de fichier physique est toujours un UUID généré en interne. Le nom original est stocké dans un fichier sidecar `.json`. Un attaquant qui envoie `../../etc/passwd` comme nom de fichier n'atteint rien.

2. **Validation MIME** : La liste des types MIME autorisés vient de la configuration. Le type est vérifié sur le contenu réel du fichier, pas seulement l'extension.

3. **Taille maximale** : Vérifiée avant l'écriture.

4. **Streaming** : Les téléchargements utilisent des streams Node.js pour ne pas charger tout le fichier en mémoire.

---

### `src/modules/pdf/`

Utilise **PDFKit**, une bibliothèque de génération PDF en pur JavaScript serveur. Pas de headless Chromium, pas de dépendances lourdes.

L'interface :
```typescript
export interface PdfGeneratorPort {
  generate<TData>(template: string, data: TData): Promise<Buffer>;
}
```

La génération retourne un `Buffer`. Le contrôleur renvoie ce buffer avec `Content-Type: application/pdf` et `Content-Disposition: attachment`. La réponse est décorée `@SkipResponseEnvelope()` pour que l'interceptor ne l'enveloppe pas en JSON.

---

### `src/modules/scheduler/`

Utilise `@nestjs/schedule`, qui repose sur `node-cron`.

#### `session-cleanup.task.ts`

La tâche planifiée principale. Elle supprime les sessions expirées depuis plus de 7 jours. Points notables :

- **Idempotente** : peut être exécutée plusieurs fois sans effet de bord.
- **Lock local** : un flag `isRunning` empêche deux exécutions simultanées dans le même processus.
- **Logging structuré** : logge début, fin, durée et nombre de sessions supprimées.
- **Gestion des erreurs** : catchée pour ne pas faire crasher le processus.

Limitation documentée : ce lock est uniquement **en mémoire**. Si deux instances de l'application tournent (déploiement multi-instance), les deux peuvent exécuter la tâche simultanément. Pour un vrai lock distribué, il faudrait Redis ou une table de lock SQL.

La tâche peut être **désactivée** globalement via `SCHEDULER_ENABLED=false`.

---

### `src/modules/observability/`

Expose les métriques Prometheus sur `GET /metrics`.

#### `metrics.service.ts`

Enregistre les compteurs et histogrammes :
- `http_requests_total` avec labels `method`, `route`, `status`
- `http_request_duration_seconds` histogramme
- Métriques Node.js par défaut (mémoire, CPU, event loop)

#### Labels et cardinalité

Règle de sécurité Prometheus souvent oubliée : les labels ne doivent jamais avoir une cardinalité élevée (beaucoup de valeurs distinctes). C'est pourquoi les labels n'incluent **jamais** `userId`, `requestId`, `sessionId` ni l'URL complète. Mettre un UUID dans un label créerait des millions de séries de métriques et ferait exploser la mémoire Prometheus.

L'interceptor `HttpMetricsInterceptor` normalise les routes : `/api/v1/users/550e8400-...` devient `/api/v1/users/:id`.

Le endpoint `/metrics` est décoré `@SkipResponseEnvelope()` et `@Public()`. Il renvoie le format texte Prometheus, pas du JSON.

---

### `src/modules/technical-demo/`

Ce module n'est **enregistré dans l'application que si** `TECHNICAL_DEMO_ENDPOINTS_ENABLED=true`. Regardez `app.module.ts` :

```typescript
...(isTechnicalDemoEnabled() ? [TechnicalDemoModule] : []),
```

La fonction `isTechnicalDemoEnabled()` est dans `bootstrap-env.ts` et lit `process.env` directement, car c'est l'un des rares endroits où c'est acceptable (avant le démarrage du module de configuration).

Ce module expose des endpoints de démonstration pour chaque brique :
- `POST /technical-demo/mail` — envoie un e-mail de test
- `POST /technical-demo/files` — upload un fichier
- `GET /technical-demo/files/:id` — télécharge un fichier
- `DELETE /technical-demo/files/:id` — supprime un fichier
- `GET /technical-demo/pdf` — génère et télécharge un PDF

Tous ces endpoints sont protégés par JWT (authentification requise).

---

## 7. Flux d'une requête HTTP de bout en bout

Prenons `GET /api/v1/auth/me` comme exemple.

```
1. Requête HTTP entre dans Express

2. RequestContextMiddleware
   └── Lit x-request-id ou génère un UUID
   └── Ouvre le contexte AsyncLocalStorage
   └── Pose x-request-id dans les headers de réponse

3. ThrottleGuard (global)
   └── Vérifie le rate limiting par IP
   └── Si dépassé → 429 Too Many Requests

4. JwtAuthGuard (global)
   └── Vérifie si la route est @Public() → non, continuer
   └── Extrait "Bearer <token>" du header Authorization
   └── Vérifie signature et expiration du JWT
   └── Enrichit request.user = { userId, sessionId }
   └── Enrichit le contexte AsyncLocalStorage avec userId, sessionId

5. ValidationPipe (global)
   └── Pas de body ni query params → rien à valider ici

6. HttpMetricsInterceptor
   └── Démarre le timer Prometheus

7. ResponseEnvelopeInterceptor
   └── S'enregistre pour transformer la réponse à la fin

8. AuthenticationController.getMe()
   └── @CurrentUser() extrait request.user
   └── Appelle GetUserByIdUseCase

9. GetUserByIdUseCase
   └── Appelle UserRepositoryPort.findById(userId)
   └── TypeOrmUserRepository exécute la requête SQL
   └── UserMapper.toDomain(entity) → User
   └── Lance ResourceNotFoundException si non trouvé

10. Retour au contrôleur
    └── Mappe User → AuthenticatedUserResponseDto

11. ResponseEnvelopeInterceptor (retour)
    └── Enveloppe la réponse : { success: true, data: {...}, meta: {...} }

12. HttpMetricsInterceptor (retour)
    └── Enregistre durée et status dans Prometheus

13. Réponse HTTP envoyée au client
    └── { success: true, data: { userId, email, displayName }, meta: {...} }
```

En cas d'erreur à n'importe quelle étape :

```
Exception lancée
    └── GlobalExceptionFilter attrape
    └── Convertit en { success: false, error: { code, message }, meta: {...} }
    └── Logge avec requestId pour diagnostic
```

---

## 8. Authentification — mécanique détaillée

### Login

```
POST /api/v1/auth/login
Body: { email: "user@example.com", password: "****" }

1. LoginRequestDto validé par ValidationPipe
   └── email: IsEmail()
   └── password: IsString(), MinLength(8)

2. LoginUseCase.execute(email, password)
   └── IdentityProviderPort.authenticate({ type: 'local', email, password })
       └── LocalIdentityProvider :
           a. normalizeEmail(email)
           b. findByEmail() → User ou null
           c. Si null : vérifie QUAND MÊME le DUMMY_HASH (timing attack)
           d. vérifie canAuthenticateLocally()
           e. passwordHasher.verify(hash, password)
           f. Si invalide → AuthenticationFailedException (message générique)
   └── sessionId = randomUUID()
   └── tokenFamilyId = randomUUID()
   └── generateAccessToken(userId, sessionId)
   └── generateRefreshToken(userId, sessionId)
   └── sessionRepository.create({ userId, refreshTokenHash: sha256(refreshToken), ... })
   └── userRepository.updateLastLoginAt(userId)
   └── auditService.record('auth.login.success')

3. AuthenticationController
   └── refreshCookie.set(response, refreshToken.token, expiresAt)
       └── Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth

4. Réponse :
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "user": { "id": "...", "email": "...", "displayName": "..." }
  }
}
```

### Refresh

```
POST /api/v1/auth/refresh
Cookie: refresh_token=eyJhbGciOiJIUzI1NiJ9...

1. refreshCookie.read(request) → refreshToken string

2. RefreshTokensUseCase.execute(refreshToken)
   └── tokenService.verifyRefreshToken(refreshToken)
       └── JwtService.verify() avec JWT_REFRESH_SECRET
       └── Si invalide → RefreshTokenInvalidException
   └── sessionRepository.findById(payload.sid)
   └── SHA-256(refreshToken) === session.refreshTokenHash ?
       └── Non → TOKEN_REUSE_DETECTED
           a. revokeFamily(tokenFamilyId)     ← toute la famille révoquée
           b. auditService.record('reuse-detected')
           c. RefreshTokenReuseDetectedException
       └── Oui → continuer
   └── session.isRevoked() → SessionRevokedException
   └── session.isExpired() → SessionExpiredException
   └── Génère nouveau accessToken + refreshToken
   └── sessionRepository.rotateRefreshToken(sessionId, newHash)
   └── auditService.record('auth.refresh.success')

3. Nouveau cookie posé, nouvel accessToken dans le body
```

---

## 9. Gestion des erreurs

### Côté application

Chaque cas d'erreur prévisible lève une exception typée :

```typescript
// Mauvais
throw new Error('User not found');

// Bon (ce projet)
throw new ResourceNotFoundException('utilisateur');
```

### Côté filtre global

`GlobalExceptionFilter` mappe les exceptions vers le format standard :

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "L'utilisateur demandé est introuvable.",
    "details": []
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-07-14T10:00:00.000Z",
    "path": "/api/v1/auth/me"
  }
}
```

### Erreurs TypeORM

Le filtre intercepte `QueryFailedError` et regarde le numéro d'erreur SQL Server :
- Erreur 2627 (violation de contrainte unique) → `RESOURCE_ALREADY_EXISTS`
- Autres erreurs SQL → `DATABASE_ERROR` (message générique, jamais le SQL brut)

---

## 10. Tests — organisation et stratégie

Trois niveaux de tests, clairement séparés.

### Tests unitaires (`*.spec.ts` à côté du fichier source)

Testent un composant isolé. Toutes les dépendances sont **mockées** avec `jest.fn()`.

```typescript
// login.use-case.spec.ts
const mockIdentityProvider = { authenticate: jest.fn() };
const mockSessionRepository = { create: jest.fn() };

const useCase = new LoginUseCase(
  mockIdentityProvider,
  mockSessionRepository,
  // ...
);
```

Ces tests sont rapides (pas de base de données) et vérifient la logique d'une classe isolément.

Fichiers concernés : tous les `*.spec.ts` dans `src/`.

### Tests d'intégration (`test/integration/`)

Utilisent une vraie base SQL Server de test. Testent les repositories, les contraintes SQL, les migrations, le soft delete.

La base de test est `nestjs_starter_test`. La CI peut utiliser la même instance SQL Server. Les tests nettoient leurs données (pas de dépendance à l'ordre d'exécution).

```
npm run test:integration
```

### Tests end-to-end (`test/e2e/`)

Démarrent l'application NestJS complète via Supertest et font des vraies requêtes HTTP.

Le helper `createE2eApplication()` crée une instance de l'application de test. `createE2eTestUser()` insère un utilisateur de test dans la base. `extractRefreshCookie()` extrait le cookie HttpOnly des headers de réponse.

Les tests e2e couvrent tout le cycle d'authentification, les cookies, les formats de réponse, la validation des DTO, les endpoints de santé, et les modules techniques.

```
npm run test:e2e
```

### Fichiers de configuration Jest

- `package.json` → configuration Jest par défaut (tests unitaires)
- `test/jest-integration.json` → surcharge pour les tests d'intégration (timeout 30s)
- `test/jest-e2e.json` → surcharge pour les tests e2e

---

## 11. Notions clés à maîtriser

Si tu viens d'Angular/Node.js, voici les concepts spécifiques à bien assimiler :

### Scoping des modules NestJS

Par défaut, les providers NestJS sont **Singleton** dans leur module. Contrairement à Angular, il n'existe pas de `providedIn: 'root'` automatique. Un provider n'est disponible que dans le module qui le déclare, ou dans les modules qui importent ce module.

`@Global()` rend un module disponible partout sans l'importer explicitement (utilisé pour `ContextModule` et `LoggingModule`).

### `forRoot()` vs `forRootAsync()`

`forRoot()` → configuration statique synchrone.  
`forRootAsync()` → configuration depuis le `ConfigService` NestJS, nécessite un `useFactory` asynchrone. Obligatoire quand la configuration dépend d'autres providers (base de données, JWT).

### `@Inject()` avec un Symbol

```typescript
// Définition du token
export const MY_SERVICE = Symbol('MY_SERVICE');

// Module
{ provide: MY_SERVICE, useClass: ConcreteService }

// Usage
constructor(@Inject(MY_SERVICE) private readonly service: IMyService) {}
```

C'est le mécanisme des ports & adapters dans NestJS : on injecte une **interface** via un Symbol, NestJS injecte l'implémentation concrète configurée dans le module.

### `AsyncLocalStorage`

API Node.js native (pas besoin de bibliothèque). Permet de stocker des données associées à une chaîne d'exécution asynchrone (une requête HTTP, une tâche planifiée). L'analogie : c'est comme `Zone.js` en Angular, mais natif et beaucoup plus léger.

### Séparation entité TypeORM / entité de domaine

En Angular tu as des interfaces TypeScript qui décrivent tes données. Ici il y a une distinction plus forte :

- **`UserEntity`** (TypeORM) : décrit la table SQL, est liée à TypeORM avec `@Entity()`, `@Column()`, etc.
- **`User`** (domaine) : classe pure TypeScript avec des méthodes métier, sans décorateur.

Le mapper convertit l'un en l'autre. Cette séparation permet de modifier le schéma SQL sans toucher à la logique métier, et vice-versa.

### Soft delete

`deletedAt` est une colonne nullable. Quand on "supprime" un utilisateur, on met `deletedAt = now()`. TypeORM avec `@DeleteDateColumn()` exclut automatiquement ces lignes de toutes les requêtes `findOne`, `find`, etc.

Un utilisateur soft-deleted ne peut pas se connecter (vérifié dans `canAuthenticateLocally()`), mais ses données restent en base pour l'audit.

---

## 12. Comment étendre le projet

### Ajouter un module métier (ex: `products`)

```
src/modules/products/
├── domain/
│   ├── product.ts                      ← Classe de domaine pure
│   ├── product-repository.port.ts      ← Interface du repository
│   └── product.spec.ts                 ← Tests unitaires du domaine
├── application/
│   ├── create-product.use-case.ts
│   └── get-products.use-case.ts
├── infrastructure/
│   ├── entities/
│   │   └── product.entity.ts           ← @Entity() TypeORM
│   ├── typeorm-product.repository.ts   ← Implémentation
│   └── product.mapper.ts
├── presentation/
│   ├── products.controller.ts
│   └── dto/
│       ├── create-product.dto.ts
│       └── product-response.dto.ts
└── products.module.ts
```

Dans `products.module.ts`, déclarer le token d'injection et lier l'implémentation concrète :

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  providers: [
    { provide: PRODUCT_REPOSITORY, useClass: TypeOrmProductRepository },
    CreateProductUseCase,
    GetProductsUseCase,
  ],
  controllers: [ProductsController],
})
export class ProductsModule {}
```

Importer `ProductsModule` dans `app.module.ts`.

Créer la migration avec `npm run migration:generate -- --name CreateProductsTable`.

### Ajouter un fournisseur SSO

1. Créer `src/modules/authentication/infrastructure/entra-id-identity.provider.ts` qui implémente `IdentityProviderPort`
2. Dans `authentication.module.ts`, remplacer `{ provide: IDENTITY_PROVIDER, useClass: LocalIdentityProvider }` par la nouvelle implémentation
3. Aucun cas d'utilisation ne change

### Ajouter un stockage cloud (Azure Blob)

1. Créer `src/modules/storage/infrastructure/azure-blob-storage.ts` qui implémente `FileStoragePort`
2. Dans `storage.module.ts`, ajouter la condition sur `STORAGE_DRIVER` pour sélectionner l'implémentation
3. Aucun endpoint ni use case ne change

### Ajouter les rôles/permissions (RBAC)

1. Créer une table `roles` et une table de liaison `user_roles` via migration
2. Implémenter `AuthorizationPort` dans l'infrastructure
3. Activer `RequiresPermissionGuard` globalement dans `app.setup.ts`
4. Décorer les endpoints avec `@RequiresPermission('products:create')`

---

*Document généré le 14 juillet 2026 — à mettre à jour si l'architecture évolue.*
