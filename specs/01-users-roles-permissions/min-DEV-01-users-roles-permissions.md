# min-DEV-01 · Guide d'implémentation pas à pas — Utilisateurs, Rôles & Permissions (version allégée)

> **Spec couverte** : `specs/01-users-roles-permissions.md`
> **Public visé** : débutant complet sur NestJS, TypeORM et l'architecture hexagonale.
> **Version allégée** : ce guide va droit au but — le code de la fonctionnalité, rien d'autre. Les tests automatisés (unitaires, intégration, e2e) et les mises à jour du seeder sont volontairement laissés de côté ; ils sont couverts par le guide complet `DEV-01-users-roles-permissions.md`.
> **Principe** : chaque étape explique le POURQUOI, donne le code complet à copier-coller, et se termine par un point de contrôle.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [A · Comprendre le socle existant (lecture obligatoire)](#a--comprendre-le-socle-existant-lecture-obligatoire)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — L'enum `UserRole`](#étape-1--lenum-userrole)
- [Étape 2 — Les nouvelles exceptions](#étape-2--les-nouvelles-exceptions)
- [Étape 3 — Le domaine : ajouter `role` à `User`](#étape-3--le-domaine--ajouter-role-à-user)
- [Étape 4 — L'infrastructure : entité + migration](#étape-4--linfrastructure--entité--migration)
- [Étape 5 — Le repository : port étendu + implémentation TypeORM](#étape-5--le-repository--port-étendu--implémentation-typeorm)
- [Étape 6 — Le rôle dans le JWT (chaîne d'authentification)](#étape-6--le-rôle-dans-le-jwt-chaîne-dauthentification)
- [Étape 7 — Le décorateur `@Roles()` et le `RolesGuard`](#étape-7--le-décorateur-roles-et-le-rolesguard)
- [Étape 8 — Les cas d'utilisation (use cases)](#étape-8--les-cas-dutilisation-use-cases)
- [Étape 9 — Les DTOs](#étape-9--les-dtos)
- [Étape 10 — Le contrôleur `UsersController`](#étape-10--le-contrôleur-userscontroller)
- [Étape 11 — Le câblage du module](#étape-11--le-câblage-du-module)
- [Étape 12 — Vérification manuelle & checklist finale](#étape-12--vérification-manuelle--checklist-finale)

---

## 0 · Avant de commencer

### 0.1 Ce que tu dois avoir sur ta machine

- Node.js (version du projet), Docker Desktop démarré, et le dépôt cloné.
- Le fichier `.env.local` présent à la racine (copié depuis `.env.local.example` si besoin).

### 0.2 Mettre l'environnement en route

Dans un terminal à la racine du projet :

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer SQL Server dans Docker
npm run docker:db:up

# 3. Créer les bases si ce n'est pas déjà fait
npm run db:init

# 4. Appliquer les migrations existantes
npm run migration:run

# 5. Insérer les utilisateurs de démonstration (admin@local.dev, user@local.dev)
npm run seed

# 6. Démarrer l'API en mode watch
npm run start:dev
```

Au démarrage, la console affiche l'URL de l'API, de la forme `http://localhost:<port>/api/v1`. **Toutes les routes du projet sont préfixées par `/api/v1`** (préfixe global + versionnement d'URI configurés dans `src/app.setup.ts`).

> 💡 **Le mot de passe des utilisateurs seedés** : si les variables `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` ne sont pas définies dans ton `.env.local`, le seeder génère un mot de passe aléatoire et l'affiche **une seule fois** dans la console. Note-le, tu en auras besoin pour tester.

### 0.3 Comment utiliser ce guide

- Suis les étapes **dans l'ordre** : elles sont conçues pour que le projet compile à chaque point de contrôle.
- Les blocs de code sont **complets** : quand le guide dit « remplace tout le fichier », colle l'intégralité du bloc.
- Deux pictogrammes reviennent partout :
  - ➕ **Créer** : le fichier n'existe pas, tu le crées.
  - ✏️ **Modifier** : le fichier existe, tu le remplaces ou tu appliques le changement indiqué (bloc AVANT / APRÈS).
- À la fin de chaque étape : **✅ Point de contrôle** — une commande à lancer. Si elle échoue, ne passe pas à l'étape suivante.

> ⚠️ **Note sur les tests existants** : le projet contient déjà des fichiers de tests (`*.spec.ts`, dossier `test/`). Cette version allégée ne les met **pas** à jour : après ce guide, `npm run build` et l'application fonctionnent parfaitement, mais `npm run test:unit` échouera sur quelques fichiers (ils référencent les anciens contrats). Le guide complet `DEV-01-users-roles-permissions.md` contient tous les correctifs — à appliquer quand l'équipe sera prête à s'occuper des tests.

---

## A · Comprendre le socle existant (lecture obligatoire)

Avant d'écrire une ligne de code, il faut comprendre **comment ce backend est organisé**. Prends 15 minutes pour lire cette section : tout le reste du guide s'appuie dessus.

### A.1 L'architecture hexagonale (ou « ports & adapters »)

Chaque module métier (ex. `src/modules/users/`) est découpé en **4 couches** :

```
src/modules/users/
├── domain/            ← Le CŒUR : classes métier pures, AUCUNE dépendance à NestJS/TypeORM
│   ├── user.ts                    (le modèle User avec ses règles métier)
│   └── user-repository.port.ts    (le "port" : contrat d'accès aux données)
├── application/       ← Les CAS D'UTILISATION : orchestrent le domaine, un fichier = une action
│   └── get-user-by-id.use-case.ts
├── infrastructure/    ← Les DÉTAILS TECHNIQUES : TypeORM, mappers
│   ├── entities/user.entity.ts    (l'entité TypeORM = la table SQL)
│   ├── user.mapper.ts             (conversion entité ↔ domaine)
│   └── typeorm-user.repository.ts (l'"adapter" : implémente le port avec TypeORM)
├── presentation/      ← L'HTTP : contrôleurs, DTOs, guards (n'existe pas encore pour users)
└── users.module.ts    ← Le câblage NestJS (injection de dépendances)
```

**Pourquoi cette séparation ?**

1. **Le domaine ne connaît personne.** `User` est une classe TypeScript pure. Si demain on remplace TypeORM par autre chose, ou REST par GraphQL, le domaine ne bouge pas.
2. **Le port est un contrat, l'adapter est une implémentation.** `UserRepositoryPort` est une *interface* définie dans le domaine. `TypeOrmUserRepository` l'implémente dans l'infrastructure. Les use cases dépendent de l'interface, jamais de l'implémentation.
3. **L'injection se fait par jeton (`Symbol`).** Comme une interface TypeScript disparaît à la compilation, NestJS ne peut pas l'utiliser comme clé d'injection. On utilise donc un `Symbol` :

```typescript
// Dans le port (domaine) :
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

// Dans le module (câblage) :
{ provide: USER_REPOSITORY, useClass: TypeOrmUserRepository }

// Dans le use case (consommation) :
constructor(
  @Inject(USER_REPOSITORY)
  private readonly userRepository: UserRepositoryPort,
) {}
```

### A.2 Le cycle de vie d'une requête HTTP

Quand un client appelle `GET /api/v1/users`, voici ce qui se passe, dans l'ordre :

```
Requête HTTP
   │
   ▼
[1] RequestContextMiddleware   → génère un requestId, ouvre un contexte AsyncLocalStorage
   │                             (utilisé par les logs, l'audit, les erreurs)
   ▼
[2] JwtAuthGuard (GLOBAL)      → toute route exige un Bearer token valide,
   │                             SAUF si décorée @Public().
   │                             Pose request.user = { userId, sessionId }
   ▼
[3] RolesGuard (GLOBAL)        → ⚠️ C'EST NOUS QUI ALLONS LE CRÉER (étape 7)
   │                             Compare request.user.role aux rôles exigés par @Roles()
   ▼
[4] ValidationPipe (GLOBAL)    → valide et transforme le body/query avec class-validator
   │                             (propriétés inconnues → 400 VALIDATION_ERROR)
   ▼
[5] Contrôleur                 → délègue au use case, ne contient AUCUNE logique métier
   ▼
[6] Use case                   → règles métier, appels au repository via le port, audit
   ▼
[7] ResponseEnvelopeInterceptor → enveloppe la réponse dans un format standard
   ▼
Réponse JSON
```

### A.3 L'enveloppe de réponse standardisée

**Tu ne construis jamais l'enveloppe toi-même** : l'interceptor global s'en charge. Ton contrôleur retourne l'objet « nu », et le client reçoit :

```jsonc
// Réponse simple — le contrôleur a retourné un UserResponseDto :
{
  "success": true,
  "data": { "id": "…", "email": "…" },
  "meta": { "requestId": "…", "timestamp": "…" }
}

// Réponse paginée — le contrôleur a retourné un PaginatedResult<T> ({ items, meta }) :
{
  "success": true,
  "data": [ { "id": "…" }, { "id": "…" } ],
  "meta": {
    "requestId": "…",
    "timestamp": "…",
    "pagination": { "page": 1, "limit": 20, "totalItems": 48, "totalPages": 3, "hasNextPage": true, "hasPreviousPage": false }
  }
}

// Erreur — levée par une AppException :
{
  "success": false,
  "error": { "code": "RESOURCE_NOT_FOUND", "message": "L'utilisateur est introuvable." },
  "meta": { "requestId": "…", "timestamp": "…", "path": "/api/v1/users/xxx" }
}
```

**Conséquence importante pour ce module** : la spec 01 demande un `UsersPageDto` (`data`, `total`, `page`…). C'est inutile ici — le socle a déjà mieux : on retourne un `PaginatedResult<UserResponseDto>` et l'enveloppe produit `data` + `meta.pagination` automatiquement.

### A.4 Les erreurs : la hiérarchie `AppException`

On ne lève **jamais** les exceptions NestJS brutes (`ConflictException`, `ForbiddenException`…) dans le code applicatif. Le socle a sa propre hiérarchie dans `src/common/exceptions/` :

- `AppException` (abstraite) porte un **code technique stable** (`ErrorCode`), un **message français** et un **statut HTTP**.
- Le `GlobalExceptionFilter` la convertit en enveloppe d'erreur standard.
- Exemples existants : `ResourceNotFoundException` (404), `ResourceAlreadyExistsException` (409), `AuthenticationFailedException` (401).

La spec 01 parle de `ConflictException` et `ForbiddenException` : dans CE projet, on créera à la place `BusinessRuleViolationException` (409) et `AccessDeniedException` (403) dans cette hiérarchie (étape 2).

### A.5 La pagination : déjà prête dans `src/common/pagination/`

La spec 10 demande de créer `PaginationDto`, `PaginatedResponseDto`, un helper… **Tout existe déjà**, en mieux :

| Brique | Rôle |
|---|---|
| `PaginationQueryDto` | Query params communs : `page`, `limit`, `sortBy`, `sortDirection`, `search`. Nos DTOs de liste l'**étendent**. |
| `PaginatedResult<T>` | Forme de retour des use cases : `{ items: T[], meta: PaginationMetaDto }`. Détectée par l'interceptor d'enveloppe. |
| `TypeOrmPaginationHelper.paginate(qb, page, limit)` | Applique `skip`/`take` sur un QueryBuilder et construit le résultat paginé. |
| `TypeOrmFilterHelper.applySort/applySearch` | Tri et recherche **sécurisés par liste blanche** : le client ne fournit jamais un nom de colonne SQL brut (anti-injection). |

### A.6 L'audit : le service `AuditService`

Chaque action métier significative est **explicitement** journalisée en base par le use case :

```typescript
await this.auditService.record({
  category: AuditCategory.Business,   // ou Security, Technical
  action: 'users.created',            // action technique stable
  resourceType: 'user',
  resourceId: user.id,
  metadata: { role: user.role },      // contexte libre (valeurs sensibles auto-expurgées)
});
```

Points clés :
- L'**acteur** (qui a fait l'action), l'IP, le requestId sont remplis **automatiquement** depuis le contexte de requête.
- Un échec d'audit **ne fait pas échouer** le use case (journalisé en erreur, c'est tout).
- Ne JAMAIS mettre de mot de passe/token dans `metadata`.

### A.7 L'authentification existante (ce qu'on va étendre)

- `JwtAuthGuard` est enregistré **globalement** dans `AuthenticationModule` via le provider `APP_GUARD` : toute route est protégée par défaut.
- Le payload du JWT d'accès est **minimal** : `{ sub: userId, sid: sessionId, jti }`. La spec 01 exige d'y ajouter `role` pour que le contrôle de rôle fonctionne **sans requête en base** à chaque appel.
- **Compromis à comprendre** : embarquer le rôle dans le JWT signifie qu'un changement de rôle ne prend effet qu'au **prochain renouvellement** du token. Comme l'access token vit 15 minutes et que le refresh recharge le rôle depuis la base (on l'implémentera ainsi), la fenêtre d'incohérence est courte et acceptable pour cet ERP. L'alternative (relire l'utilisateur en base à chaque requête) coûte une requête SQL par appel.

### A.8 La base de données : SQL Server, migrations manuelles

⚠️ **La spec 01 mentionne un `user_role_enum` PostgreSQL — ce projet tourne sur SQL Server** (regarde `docker-compose` et le driver `mssql`). SQL Server n'a pas de type `ENUM` natif : on stocke le rôle en `nvarchar(20)` avec une contrainte `DEFAULT`. C'est le même pattern que la colonne `authentication_source` existante.

Les migrations sont des fichiers TypeScript dans `src/database/migrations/`, avec du SQL écrit à la main (`up` = appliquer, `down` = annuler). Elles s'exécutent avec `npm run migration:run`.

---

## B · Ce qu'on va construire

### B.1 Les endpoints

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/users` | ADMIN, MANAGER | Liste paginée, filtres `role`, `isActive`, `search` |
| `GET /api/v1/users/me` | tout utilisateur connecté | Mon profil |
| `PATCH /api/v1/users/me` | tout utilisateur connecté | Modifier mon `displayName` (rien d'autre) |
| `GET /api/v1/users/:id` | ADMIN, MANAGER | Détail d'un utilisateur |
| `POST /api/v1/users` | ADMIN | Créer un utilisateur (201) |
| `PATCH /api/v1/users/:id` | ADMIN | Modifier `displayName` / `isActive` |
| `PATCH /api/v1/users/:id/role` | ADMIN | Changer le rôle |
| `DELETE /api/v1/users/:id` | ADMIN | Désactiver (soft-delete, 204) |

### B.2 Les règles métier

| Règle | Où elle est appliquée |
|---|---|
| E-mail unique, normalisé (trim + minuscules) | `CreateUserUseCase` |
| Mot de passe hashé en Argon2id, jamais exposé | `CreateUserUseCase` + `UserResponseDto` (le hash n'y figure pas) |
| Impossible de rétrograder le **dernier ADMIN actif** | `ChangeUserRoleUseCase` |
| Impossible de désactiver le **dernier ADMIN actif** | `DeactivateUserUseCase` |
| Un utilisateur ne peut pas se désactiver lui-même | `DeactivateUserUseCase` |
| Le rôle voyage dans le JWT (pas de requête SQL par appel) | `TokenService` + `JwtAuthGuard` + `RolesGuard` |

### B.3 Écarts assumés par rapport à la spec 01

Ces adaptations collent le module au socle réel — note-les, elles seront réutilisées dans tous les modules suivants :

1. **SQL Server, pas PostgreSQL** → colonne `nvarchar(20)` + `DEFAULT 'EMPLOYEE'` au lieu d'un type enum.
2. **Pagination du socle réutilisée** → pas de `UsersPageDto` : `PaginatedResult<UserResponseDto>` + enveloppe automatique.
3. **Exceptions du socle** → `AccessDeniedException` / `BusinessRuleViolationException` au lieu de `ForbiddenException` / `ConflictException` NestJS.
4. **`GET /users/:id` et `PATCH /users/:id` réservés à ADMIN/MANAGER (resp. ADMIN)** : le cas « ou soi-même » de la spec passe proprement par `GET /users/me` et `PATCH /users/me`. Deux routes dédiées valent mieux qu'une logique conditionnelle « admin OU propriétaire » dans un guard.
5. **`DELETE` = désactivation** : soft-delete TypeORM (`deleted_at`) + `is_active = false`. La donnée n'est jamais détruite physiquement.

### B.4 Tous les fichiers touchés (vue d'ensemble)

**➕ Fichiers créés :**

```
src/common/enums/user-role.enum.ts
src/common/decorators/roles.decorator.ts
src/common/guards/roles.guard.ts
src/database/migrations/<timestamp>-AddRoleToUsers.ts
src/modules/users/application/list-users.use-case.ts
src/modules/users/application/create-user.use-case.ts
src/modules/users/application/update-user.use-case.ts
src/modules/users/application/change-user-role.use-case.ts
src/modules/users/application/deactivate-user.use-case.ts
src/modules/users/presentation/dto/list-users-query.dto.ts
src/modules/users/presentation/dto/create-user.dto.ts
src/modules/users/presentation/dto/update-user.dto.ts
src/modules/users/presentation/dto/update-my-profile.dto.ts
src/modules/users/presentation/dto/change-role.dto.ts
src/modules/users/presentation/dto/user-response.dto.ts
src/modules/users/presentation/users.controller.ts
```

**✏️ Fichiers modifiés :**

```
src/common/exceptions/error-code.enum.ts        (+2 codes)
src/common/exceptions/app-exceptions.ts          (+2 exceptions)
src/common/interfaces/authenticated-user.ts      (+ role)
src/modules/users/domain/user.ts                 (+ role)
src/modules/users/domain/user-repository.port.ts (+5 méthodes)
src/modules/users/infrastructure/entities/user.entity.ts (+ colonne role)
src/modules/users/infrastructure/user.mapper.ts  (+ role)
src/modules/users/infrastructure/typeorm-user.repository.ts (+5 méthodes)
src/modules/users/users.module.ts                (contrôleur + use cases + hasher)
src/modules/authentication/application/token.service.ts      (role dans l'access token)
src/modules/authentication/domain/identity-provider.port.ts  (role dans l'identité)
src/modules/authentication/infrastructure/local-identity.provider.ts
src/modules/authentication/application/login.use-case.ts
src/modules/authentication/application/refresh-tokens.use-case.ts (+ rechargement du rôle)
src/modules/authentication/presentation/jwt-auth.guard.ts    (role dans request.user)
src/modules/authentication/authentication.module.ts          (RolesGuard global)
```

C'est parti. 🚀

---

## Étape 1 — L'enum `UserRole`

### Pourquoi commencer par là ?

Tout le module tourne autour de trois rôles. On les définit dans `src/common/` (et pas dans `src/modules/users/`) parce que **tous les modules suivants** (contacts, devis, commandes…) importeront cet enum pour décorer leurs routes avec `@Roles(...)`. Une brique partagée vit dans `common`.

### ➕ Créer `src/common/enums/user-role.enum.ts`

> Le dossier `src/common/enums/` n'existe pas encore : crée-le.

```typescript
/**
 * Rôles applicatifs de l'ERP (RBAC simple à trois niveaux).
 *
 * ADMIN    : gestion des utilisateurs et des rôles, suppression de données.
 * MANAGER  : gestion métier courante (contacts, catalogue, devis, commandes...).
 * EMPLOYEE : consultation et opérations du quotidien (rôle par défaut).
 *
 * La valeur (chaîne) est stockée telle quelle en base (nvarchar) et
 * embarquée dans le claim `role` du JWT d'accès : ne JAMAIS renommer une
 * valeur existante sans migration de données.
 */
export enum UserRole {
  Admin = 'ADMIN',
  Manager = 'MANAGER',
  Employee = 'EMPLOYEE',
}
```

**Ce qu'il faut comprendre :**

- **Clé PascalCase, valeur SCREAMING_CASE** : c'est la convention du projet (regarde `AuthenticationSource.Local = 'LOCAL'`). La clé sert dans le code (`UserRole.Admin`), la valeur part en base et dans le JWT.
- Un enum TypeScript à valeurs chaînes survit à la sérialisation JSON : `JSON.stringify({ role: UserRole.Admin })` → `{"role":"ADMIN"}`. C'est exactement ce qu'on veut pour le JWT et l'API.

### ✅ Point de contrôle

```bash
npm run build
```

Le build doit passer (le fichier n'est encore importé nulle part, c'est normal).

---

## Étape 2 — Les nouvelles exceptions

### Pourquoi ?

Deux situations nouvelles vont devoir être signalées au client :

1. **403 — rôle insuffisant** : un EMPLOYEE appelle `POST /users`. La spec dit `ForbiddenException` ; dans ce projet on crée `AccessDeniedException` dans la hiérarchie `AppException` (voir §A.4) pour bénéficier du code stable et de l'enveloppe d'erreur.
2. **409 — règle métier violée** : rétrograder le dernier ADMIN, se désactiver soi-même… La requête est valide *techniquement* mais interdite *métier*. On crée `BusinessRuleViolationException`.

### ✏️ Modifier `src/common/exceptions/error-code.enum.ts`

Ajoute deux valeurs **à la fin** de l'enum existant :

**AVANT** (fin du fichier) :

```typescript
  TooManyRequests = 'TOO_MANY_REQUESTS',
  InternalServerError = 'INTERNAL_SERVER_ERROR',
}
```

**APRÈS** :

```typescript
  TooManyRequests = 'TOO_MANY_REQUESTS',
  InternalServerError = 'INTERNAL_SERVER_ERROR',
  AccessDenied = 'ACCESS_DENIED',
  BusinessRuleViolation = 'BUSINESS_RULE_VIOLATION',
}
```

**Pourquoi un code stable ?** Le commentaire en tête du fichier l'explique : les messages français peuvent changer, les codes JAMAIS. Un front peut écrire `if (error.code === 'ACCESS_DENIED')` en toute confiance.

### ✏️ Modifier `src/common/exceptions/app-exceptions.ts`

Ajoute ces deux classes **à la fin du fichier** (après `FileTooLargeException`) :

```typescript
/**
 * Utilisateur authentifié mais dont le rôle ne permet pas l'action.
 *
 * À distinguer du 401 (non authentifié) : ici l'identité est connue,
 * c'est l'autorisation qui manque. Levée principalement par RolesGuard.
 */
export class AccessDeniedException extends AppException {
  constructor(
    message = "Vous n'avez pas les droits nécessaires pour effectuer cette action.",
  ) {
    super(ErrorCode.AccessDenied, message, HttpStatus.FORBIDDEN);
  }
}

/**
 * Règle métier violée : la requête est bien formée mais l'état actuel
 * des données interdit l'opération (ex. : rétrograder le dernier ADMIN).
 *
 * Le message est obligatoire : il doit dire PRÉCISÉMENT quelle règle
 * bloque, c'est la seule information exploitable par l'utilisateur.
 */
export class BusinessRuleViolationException extends AppException {
  constructor(message: string) {
    super(ErrorCode.BusinessRuleViolation, message, HttpStatus.CONFLICT);
  }
}
```

**Ce qu'il faut comprendre :**

- `HttpStatus.FORBIDDEN` = 403, `HttpStatus.CONFLICT` = 409. Le statut HTTP est figé par la classe : impossible de se tromper à l'usage.
- `AccessDeniedException` a un message **par défaut** (cas nominal du guard), surchargeable. `BusinessRuleViolationException` **exige** un message : une violation de règle métier sans explication est inutilisable.

### ✅ Point de contrôle

```bash
npm run build
```

---

## Étape 3 — Le domaine : ajouter `role` à `User`

### Pourquoi ?

Le modèle de domaine `User` est LA représentation métier d'un utilisateur. Chaque couche au-dessus (use cases, contrôleur) manipule cette classe, jamais l'entité TypeORM. Ajouter le rôle commence donc ici.

La classe `User` utilise un **constructeur positionnel avec des `readonly`** : l'objet est immuable (on ne modifie jamais un `User` en mémoire, on repasse par le repository). En ajoutant un paramètre au milieu du constructeur, **les endroits qui construisent un `User` vont casser à la compilation** — c'est voulu : TypeScript nous donne la liste exhaustive des points à mettre à jour (ici : le mapper, corrigé à l'étape 4).

### ✏️ Modifier `src/modules/users/domain/user.ts`

Remplace tout le fichier par :

```typescript
import { UserRole } from '../../../common/enums/user-role.enum';
import { AuthenticationSource } from './authentication-source.enum';

/**
 * Modèle de domaine de l'utilisateur technique.
 *
 * Classe pure : aucune dépendance à NestJS, TypeORM ou Express.
 * L'entité TypeORM correspondante vit dans la couche infrastructure ;
 * le UserMapper assure la conversion entre les deux.
 */
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly displayName: string,
    /** Hash Argon2id ; null pour les comptes SSO (aucun mot de passe local). */
    public readonly passwordHash: string | null,
    public readonly authenticationSource: AuthenticationSource,
    /** Rôle applicatif : gouverne les autorisations via RolesGuard. */
    public readonly role: UserRole,
    public readonly isActive: boolean,
    public readonly lastLoginAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  /**
   * Un utilisateur ne peut s'authentifier localement que s'il est actif,
   * non supprimé et possède un mot de passe local.
   */
  canAuthenticateLocally(): boolean {
    return (
      this.isActive &&
      this.deletedAt === null &&
      this.passwordHash !== null &&
      this.authenticationSource === AuthenticationSource.Local
    );
  }
}

/**
 * Normalise un e-mail : minuscules et espaces retirés.
 * Appliquée AVANT toute recherche ou écriture en base.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

> 📌 Le paramètre `role` est inséré **après `authenticationSource`** et **avant `isActive`**. Retiens cet ordre : le mapper doit le respecter.

### ✏️ Modifier `src/modules/users/infrastructure/user.mapper.ts`

Le mapper convertit l'entité TypeORM (ligne SQL) en modèle de domaine. Remplace tout le fichier :

```typescript
import { Injectable } from '@nestjs/common';
import { User } from '../domain/user';
import { UserEntity } from './entities/user.entity';

/**
 * Conversion entité TypeORM <-> modèle de domaine.
 *
 * Le domaine ne voit jamais l'entité TypeORM : les contrôleurs et cas
 * d'utilisation travaillent exclusivement avec User.
 */
@Injectable()
export class UserMapper {
  toDomain(entity: UserEntity): User {
    return new User(
      entity.id,
      entity.email,
      entity.displayName,
      entity.passwordHash,
      entity.authenticationSource,
      entity.role,
      entity.isActive,
      entity.lastLoginAt,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
```

> ⚠️ À ce stade, `entity.role` n'existe pas encore → **erreur de compilation attendue**. On la corrige à l'étape 4 en ajoutant la colonne à l'entité. C'est la seule fois du guide où un point de contrôle est différé.

### ✅ Point de contrôle

Aucune commande ici : la compilation est volontairement cassée jusqu'à la fin de l'étape 4. Vérifie juste que tes fichiers sont sauvegardés.

---

## Étape 4 — L'infrastructure : entité + migration

### 4.1 La colonne `role` sur l'entité TypeORM

L'entité TypeORM décrit la table SQL. Les décorateurs `@Column` mappent les propriétés TypeScript (camelCase) vers les colonnes SQL (snake_case).

### ✏️ Modifier `src/modules/users/infrastructure/entities/user.entity.ts`

Remplace tout le fichier :

```typescript
import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { AuthenticationSource } from '../../domain/authentication-source.enum';

/**
 * Entité TypeORM de la table `users`.
 *
 * Représente un utilisateur technique pouvant s'authentifier localement
 * ou, plus tard, être associé à une identité SSO.
 *
 * Contraintes portées par le schéma :
 *   - e-mail unique (index filtré sur les lignes non supprimées) ;
 *   - e-mail normalisé en minuscules par la couche application AVANT
 *     toute écriture ou recherche ;
 *   - password_hash nullable : les futurs comptes SSO n'ont pas de
 *     mot de passe local ; jamais de mot de passe en clair.
 */
@Entity({ name: 'users' })
export class UserEntity extends AuditableEntity {
  @Index('UQ_users_email', { unique: true })
  @Column({ name: 'email', type: 'nvarchar', length: 320 })
  email!: string;

  @Column({ name: 'display_name', type: 'nvarchar', length: 200 })
  displayName!: string;

  /** Hash Argon2id du mot de passe ; null pour les comptes SSO. */
  @Column({
    name: 'password_hash',
    type: 'nvarchar',
    length: 500,
    nullable: true,
  })
  passwordHash!: string | null;

  @Column({
    name: 'authentication_source',
    type: 'nvarchar',
    length: 20,
    default: AuthenticationSource.Local,
  })
  authenticationSource!: AuthenticationSource;

  /**
   * Rôle applicatif (RBAC). SQL Server n'a pas de type enum : la valeur
   * de l'enum TypeScript est stockée en nvarchar, comme pour
   * authentication_source.
   */
  @Column({
    name: 'role',
    type: 'nvarchar',
    length: 20,
    default: UserRole.Employee,
  })
  role!: UserRole;

  /** Un utilisateur inactif ne peut plus se connecter. */
  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', type: 'datetime2', nullable: true })
  lastLoginAt!: Date | null;
}
```

**Ce qu'il faut comprendre :**

- `extends AuditableEntity` : la classe de base du socle fournit `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (soft-delete), `createdBy`, `updatedBy`. On ne les redéclare jamais.
- `default: UserRole.Employee` : le défaut vit **aussi** côté SQL (via la migration ci-dessous) — un `INSERT` qui omet le rôle produit un EMPLOYEE, jamais un NULL.

### 4.2 La migration

**Une migration = un changement de schéma versionné.** L'entité TypeScript décrit l'état cible, mais c'est la migration qui modifie réellement la base — le projet n'utilise jamais `synchronize: true` (dangereux : TypeORM modifierait le schéma tout seul).

Génère le squelette avec la CLI (le timestamp dans le nom garantit l'ordre d'exécution) :

```bash
npm run migration:create -- src/database/migrations/AddRoleToUsers
```

Un fichier `src/database/migrations/<timestamp>-AddRoleToUsers.ts` apparaît, avec une classe nommée `AddRoleToUsers<timestamp>`.

### ✏️ Compléter le fichier de migration généré

**Garde le nom de classe généré** (avec SON timestamp), et remplis `up`/`down` ainsi :

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleToUsers1234567890123 implements MigrationInterface {
  name = 'AddRoleToUsers1234567890123'; // ← garde le timestamp généré chez toi

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Contrainte DEFAULT nommée : SQL Server exige un nom pour pouvoir
    // la supprimer proprement dans down() (un DEFAULT anonyme reçoit un
    // nom aléatoire impossible à cibler).
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" nvarchar(20) NOT NULL ` +
        `CONSTRAINT "DF_users_role" DEFAULT 'EMPLOYEE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordre inverse de up : d'abord la contrainte, ensuite la colonne.
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "DF_users_role"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
  }
}
```

**Ce qu'il faut comprendre :**

- `NOT NULL ... DEFAULT 'EMPLOYEE'` : les lignes **déjà existantes** (admin@local.dev, user@local.dev…) reçoivent automatiquement `EMPLOYEE` au moment du `ALTER TABLE`. Personne ne devient ADMIN par accident.
- `down()` doit remettre la base **exactement** dans l'état d'avant : c'est ta roue de secours (`npm run migration:revert`).

Applique la migration :

```bash
npm run migration:run
```

Tu peux vérifier avec `npm run migration:show` (la migration doit apparaître cochée `[X]`).

### 4.3 Promouvoir l'administrateur existant

La migration a donné `EMPLOYEE` à tout le monde, y compris à `admin@local.dev`. Pour pouvoir tester les routes ADMIN, promeus-le avec cette requête SQL (via ton client SQL habituel, ex. Azure Data Studio / SSMS connecté au conteneur Docker) :

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@local.dev';
```

> 💡 Dans le guide complet, cette attribution est intégrée au seeder pour être automatique. Ici, une requête suffit.

### ✅ Point de contrôle

```bash
npm run build
```

Le build repasse au vert (le mapper trouve maintenant `entity.role`). Vérifie en base que `admin@local.dev` a bien `role = 'ADMIN'`.

---

## Étape 5 — Le repository : port étendu + implémentation TypeORM

### Pourquoi ?

Le port actuel ne sait que lire (`findById`, `findByEmail`) et mettre à jour la date de connexion. Nos use cases ont besoin de : lister avec filtres/pagination, créer, modifier, désactiver, et compter les ADMIN actifs (pour la règle « dernier admin »).

**Règle d'or** : on définit d'abord le **contrat** (le port, dans le domaine), ensuite seulement l'**implémentation** (l'adapter TypeORM, dans l'infrastructure).

### ✏️ Modifier `src/modules/users/domain/user-repository.port.ts`

Remplace tout le fichier :

```typescript
import { UserRole } from '../../../common/enums/user-role.enum';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { User } from './user';

/**
 * Critères de listing des utilisateurs.
 *
 * Reprend les paramètres communs de pagination du socle, complétés par
 * les filtres propres au module.
 */
export interface ListUsersQuery {
  page: number;
  limit: number;
  /** Colonne logique de tri (validée contre la liste blanche du module). */
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur email et displayName. */
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

/** Données nécessaires à la création d'un utilisateur local. */
export interface CreateUserData {
  /** E-mail déjà normalisé par l'appelant (trim + minuscules). */
  email: string;
  displayName: string;
  /** Hash Argon2id déjà calculé — JAMAIS de mot de passe en clair ici. */
  passwordHash: string;
  role: UserRole;
}

/** Champs modifiables d'un utilisateur (tous optionnels). */
export interface UpdateUserData {
  displayName?: string;
  isActive?: boolean;
  role?: UserRole;
}

/**
 * Contrat de persistance des utilisateurs.
 *
 * Défini dans le domaine, implémenté par l'infrastructure TypeORM.
 * Les recherches excluent les utilisateurs supprimés logiquement.
 */
export interface UserRepositoryPort {
  /** Liste paginée et filtrée. */
  findAll(query: ListUsersQuery): Promise<PaginatedResult<User>>;

  /** Recherche par identifiant ; null si inconnu ou supprimé. */
  findById(id: string): Promise<User | null>;

  /**
   * Recherche par e-mail (déjà normalisé par l'appelant) ;
   * null si inconnu ou supprimé.
   */
  findByEmail(email: string): Promise<User | null>;

  /** Crée un utilisateur local actif et le renvoie. */
  create(data: CreateUserData): Promise<User>;

  /** Applique les champs fournis et renvoie l'utilisateur à jour. */
  update(id: string, data: UpdateUserData): Promise<User>;

  /** Suppression logique : pose deleted_at ET is_active = false. */
  softDelete(id: string): Promise<void>;

  /**
   * Nombre d'ADMIN actifs et non supprimés.
   * Sert à protéger le « dernier administrateur ».
   */
  countActiveAdmins(): Promise<number>;

  /** Met à jour la date de dernière connexion. */
  updateLastLoginAt(id: string, lastLoginAt: Date): Promise<void>;
}

/** Jeton d'injection du repository utilisateurs. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
```

**Ce qu'il faut comprendre :**

- Les interfaces `ListUsersQuery` / `CreateUserData` / `UpdateUserData` vivent **avec le port** : ce sont des types du contrat, pas des DTOs HTTP. Les DTOs (étape 9) valideront l'entrée HTTP puis seront convertis vers ces types.
- `PaginatedResult` vient de `src/common/pagination/` : le domaine peut dépendre de `common` (briques transverses neutres), jamais de `infrastructure`.
- Le port documente les **garanties** (« e-mail déjà normalisé », « hash déjà calculé ») : l'implémentation n'a pas à re-vérifier, le use case est responsable.

### ✏️ Modifier `src/modules/users/infrastructure/typeorm-user.repository.ts`

Remplace tout le fichier :

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { User } from '../domain/user';
import {
  CreateUserData,
  ListUsersQuery,
  UpdateUserData,
  UserRepositoryPort,
} from '../domain/user-repository.port';
import { AuthenticationSource } from '../domain/authentication-source.enum';
import { UserEntity } from './entities/user.entity';
import { UserMapper } from './user.mapper';

/**
 * Liste blanche de tri : nom logique exposé par l'API -> expression
 * TypeORM. SEULE source des colonnes utilisées dans ORDER BY : une
 * valeur hors liste est rejetée en 400 (anti-injection SQL).
 */
const USER_SORTABLE_COLUMNS: ColumnWhitelist = {
  email: 'user.email',
  displayName: 'user.displayName',
  role: 'user.role',
  isActive: 'user.isActive',
  createdAt: 'user.createdAt',
  lastLoginAt: 'user.lastLoginAt',
};

/** Colonnes parcourues par la recherche textuelle (paramètre search). */
const USER_SEARCHABLE_COLUMNS = ['user.email', 'user.displayName'] as const;

/**
 * Implémentation TypeORM du repository utilisateurs.
 *
 * Les recherches standard excluent automatiquement les lignes
 * soft-deletées (comportement TypeORM avec @DeleteDateColumn).
 */
@Injectable()
export class TypeOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
    private readonly mapper: UserMapper,
  ) {}

  async findAll(query: ListUsersQuery): Promise<PaginatedResult<User>> {
    const queryBuilder = this.repository.createQueryBuilder('user');

    if (query.role !== undefined) {
      queryBuilder.andWhere('user.role = :role', { role: query.role });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      USER_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      // Tri par défaut : les plus récents d'abord.
      queryBuilder.orderBy('user.createdAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        USER_SORTABLE_COLUMNS,
      );
    }

    const result = await TypeOrmPaginationHelper.paginate(
      queryBuilder,
      query.page,
      query.limit,
    );

    return {
      items: result.items.map((entity) => this.mapper.toDomain(entity)),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repository.findOne({ where: { email } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const entity = await this.repository.save(
      this.repository.create({
        email: data.email,
        displayName: data.displayName,
        passwordHash: data.passwordHash,
        authenticationSource: AuthenticationSource.Local,
        role: data.role,
        isActive: true,
      }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    // Seuls les champs réellement fournis sont écrits : un undefined ne
    // doit jamais écraser une valeur en base.
    const changes: Partial<UserEntity> = {};
    if (data.displayName !== undefined) {
      changes.displayName = data.displayName;
    }
    if (data.isActive !== undefined) {
      changes.isActive = data.isActive;
    }
    if (data.role !== undefined) {
      changes.role = data.role;
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }

    // Relecture : renvoie l'état réel en base (updated_at recalculé).
    const entity = await this.repository.findOne({ where: { id } });
    // L'appelant (use case) a vérifié l'existence avant de modifier.
    return this.mapper.toDomain(entity as UserEntity);
  }

  async softDelete(id: string): Promise<void> {
    // is_active = false AVANT le soft-delete : une ligne restaurée un
    // jour ne doit pas revenir active par surprise.
    await this.repository.update({ id }, { isActive: false });
    await this.repository.softDelete({ id });
  }

  countActiveAdmins(): Promise<number> {
    // count() de TypeORM exclut d'office les lignes soft-deletées.
    return this.repository.count({
      where: { role: UserRole.Admin, isActive: true },
    });
  }

  async updateLastLoginAt(id: string, lastLoginAt: Date): Promise<void> {
    await this.repository.update({ id }, { lastLoginAt });
  }
}
```

**Ce qu'il faut comprendre :**

- **`createQueryBuilder('user')`** : `'user'` est l'alias SQL. Ensuite, `'user.isActive'` désigne la *propriété* TypeScript — TypeORM la traduit lui-même en `is_active`. C'est pour ça que la liste blanche contient `user.displayName` et pas `user.display_name`.
- **`andWhere(..., { role: query.role })`** : les valeurs passent TOUJOURS par des paramètres nommés (`:role`), jamais par concaténation de chaînes — protection contre l'injection SQL.
- **`applySearch`** neutralise les jokers `%`/`_`/`[` de la saisie utilisateur avant le `LIKE` (regarde son code dans `typeorm-filter.helper.ts`, c'est instructif).
- **`update()` relit la ligne après écriture** : `repository.update()` ne renvoie pas l'entité ; on relit pour retourner l'état réel (avec `updated_at` recalculé par la base).

### ✅ Point de contrôle

```bash
npm run build
```

---

## Étape 6 — Le rôle dans le JWT (chaîne d'authentification)

### Vue d'ensemble : pourquoi 6 fichiers ?

Objectif : que chaque access token porte un claim `role`, et que `request.user` le contienne. Le rôle doit traverser toute la chaîne :

```
LOGIN :
  LocalIdentityProvider ──(role)──▶ LoginUseCase ──(role)──▶ TokenService ──▶ JWT { sub, sid, jti, role }

REFRESH (toutes les ~15 min) :
  RefreshTokensUseCase ──(relit le user en base : rôle FRAIS)──▶ TokenService ──▶ nouveau JWT

CHAQUE REQUÊTE :
  JwtAuthGuard ──(vérifie la signature, lit payload.role)──▶ request.user = { userId, sessionId, role }
```

Le point subtil est le **refresh** : c'est lui qui recharge le rôle depuis la base. Ainsi, un changement de rôle (ou une désactivation !) prend effet au plus tard au prochain renouvellement du token — sans coûter une requête SQL à chaque appel API.

### 6.1 Le contrat d'utilisateur authentifié

### ✏️ Modifier `src/common/interfaces/authenticated-user.ts`

Remplace tout le fichier :

```typescript
import { UserRole } from '../enums/user-role.enum';

/**
 * Utilisateur authentifié tel qu'exposé dans le contexte HTTP.
 *
 * Type strict et minimal : les contrôleurs n'accèdent JAMAIS à l'entité
 * TypeORM ni au modèle de domaine complet via la requête. Récupéré dans
 * les handlers avec le décorateur @CurrentUser().
 */
export interface AuthenticatedUser {
  /** Identifiant de l'utilisateur (claim sub du JWT). */
  userId: string;
  /** Identifiant de la session porteuse (claim sid du JWT). */
  sessionId: string;
  /** Rôle applicatif (claim role du JWT) : évalué par RolesGuard. */
  role: UserRole;
}
```

### 6.2 Le `TokenService` : émettre le claim `role`

### ✏️ Modifier `src/modules/authentication/application/token.service.ts`

Trois changements : le type `TokenPayload`, la signature de `generateAccessToken`, et la méthode privée `generate`. Remplace tout le fichier :

```typescript
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { createHash, randomUUID } from 'node:crypto';
import { UserRole } from '../../../common/enums/user-role.enum';
import {
  AccessTokenInvalidException,
  RefreshTokenInvalidException,
} from '../../../common/exceptions/app-exceptions';
import { authConfig } from '../../../config/auth.config';

/** Claims portés par les jetons du socle. */
export interface TokenPayload {
  /** Identifiant de l'utilisateur. */
  sub: string;
  /** Identifiant de la session. */
  sid: string;
  /** Identifiant unique du jeton. */
  jti: string;
  /**
   * Rôle applicatif — présent UNIQUEMENT sur les access tokens.
   * Le refresh token n'en a pas besoin : le rôle est relu en base
   * lors de chaque rotation (source de vérité).
   */
  role?: UserRole;
  iat: number;
  exp: number;
}

/** Jeton généré accompagné de sa date d'expiration. */
export interface GeneratedToken {
  token: string;
  expiresAt: Date;
}

/**
 * Service de génération et vérification des JWT.
 *
 * - access token : durée courte, transmis dans Authorization: Bearer ;
 *   porte le claim `role` pour que RolesGuard statue sans requête SQL ;
 * - refresh token : durée longue, secret DISTINCT, transmis en cookie
 *   HttpOnly, jamais stocké en clair (seule son empreinte SHA-256 est
 *   conservée en base pour comparaison lors des rotations).
 *
 * Les payloads restent minimaux : aucune donnée personnelle n'est
 * embarquée. Le rôle est le seul claim d'autorisation ; un changement de
 * rôle prend effet à la prochaine rotation (durée de vie courte de
 * l'access token).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async generateAccessToken(
    userId: string,
    sessionId: string,
    role: UserRole,
  ): Promise<GeneratedToken> {
    return this.generate(
      userId,
      sessionId,
      this.config.accessTokenSecret,
      this.config.accessTokenExpiration,
      { role },
    );
  }

  async generateRefreshToken(
    userId: string,
    sessionId: string,
  ): Promise<GeneratedToken> {
    return this.generate(
      userId,
      sessionId,
      this.config.refreshTokenSecret,
      this.config.refreshTokenExpiration,
    );
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.config.accessTokenSecret,
      });
    } catch {
      throw new AccessTokenInvalidException();
    }
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.config.refreshTokenSecret,
      });
    } catch {
      throw new RefreshTokenInvalidException();
    }
  }

  /**
   * Empreinte SHA-256 d'un refresh token.
   *
   * SHA-256 (et non Argon2) : le token est déjà une valeur à très haute
   * entropie signée cryptographiquement ; une empreinte rapide et
   * déterministe suffit et permet la comparaison directe en base.
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async generate(
    userId: string,
    sessionId: string,
    secret: string,
    expiresIn: string,
    extraClaims: Record<string, unknown> = {},
  ): Promise<GeneratedToken> {
    const token = await this.jwtService.signAsync(
      { sub: userId, sid: sessionId, jti: randomUUID(), ...extraClaims },
      // La durée configurée ("15m", "7d") correspond au format StringValue
      // attendu par jsonwebtoken ; la validation d'environnement garantit
      // une chaîne non vide.
      { secret, expiresIn: expiresIn as StringValue },
    );

    // L'expiration est relue depuis le jeton signé : une seule source
    // de vérité, pas de double interprétation de la durée configurée.
    const payload = this.jwtService.decode<TokenPayload>(token);
    return { token, expiresAt: new Date(payload.exp * 1000) };
  }
}
```

**Ce qu'il faut comprendre :**

- `role` est **obligatoire** dans `generateAccessToken` : impossible d'émettre un access token sans rôle (TypeScript refuse). Mais **optionnel** dans `TokenPayload`, car le même type décrit aussi le refresh token, qui n'en porte pas.
- `extraClaims` avec un défaut `{}` : le refresh token n'est pas modifié.

### 6.3 Le fournisseur d'identité : renvoyer le rôle au login

### ✏️ Modifier `src/modules/authentication/domain/identity-provider.port.ts`

Une seule retouche : l'interface `AuthenticatedIdentity` gagne le rôle.

**AVANT** :

```typescript
export interface AuthenticatedIdentity {
  userId: string;
  email: string;
  displayName: string;
}
```

**APRÈS** (ajoute aussi l'import en haut du fichier) :

```typescript
import { UserRole } from '../../../common/enums/user-role.enum';
```

```typescript
export interface AuthenticatedIdentity {
  userId: string;
  email: string;
  displayName: string;
  /** Rôle applicatif, embarqué dans l'access token émis au login. */
  role: UserRole;
}
```

### ✏️ Modifier `src/modules/authentication/infrastructure/local-identity.provider.ts`

Une seule retouche : le `return` final de `authenticate` renvoie le rôle.

**AVANT** :

```typescript
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    };
```

**APRÈS** :

```typescript
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
```

### 6.4 Le login : transmettre le rôle au `TokenService`

### ✏️ Modifier `src/modules/authentication/application/login.use-case.ts`

Une seule ligne change : l'appel à `generateAccessToken`.

**AVANT** :

```typescript
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(identity.userId, sessionId),
      this.tokenService.generateRefreshToken(identity.userId, sessionId),
    ]);
```

**APRÈS** :

```typescript
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(
        identity.userId,
        sessionId,
        identity.role,
      ),
      this.tokenService.generateRefreshToken(identity.userId, sessionId),
    ]);
```

### 6.5 Le refresh : recharger le rôle depuis la base

C'est le changement le plus intéressant de l'étape. À chaque rotation de tokens (~15 min), on relit l'utilisateur en base :

- son **rôle actuel** part dans le nouvel access token (un changement de rôle se propage donc tout seul) ;
- s'il a été **désactivé ou supprimé**, le refresh est refusé → l'utilisateur est déconnecté de fait. Bonus sécurité gratuit.

### ✏️ Modifier `src/modules/authentication/application/refresh-tokens.use-case.ts`

Remplace tout le fichier :

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  RefreshTokenInvalidException,
  RefreshTokenReuseDetectedException,
  SessionExpiredException,
  SessionRevokedException,
} from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { USER_REPOSITORY } from '../../users/domain/user-repository.port';
import type { UserRepositoryPort } from '../../users/domain/user-repository.port';
import { SessionRevocationReason } from '../domain/auth-session';
import { AUTH_SESSION_REPOSITORY } from '../domain/auth-session-repository.port';
import type { AuthSessionRepositoryPort } from '../domain/auth-session-repository.port';
import { GeneratedToken, TokenService } from './token.service';

/** Résultat d'un rafraîchissement réussi. */
export interface RefreshResult {
  accessToken: GeneratedToken;
  refreshToken: GeneratedToken;
  userId: string;
}

/**
 * Cas d'utilisation : rotation des jetons.
 *
 * À chaque rafraîchissement :
 *   1. vérifie la signature du refresh token ;
 *   2. retrouve la session (claim sid) ;
 *   3. compare l'empreinte du token reçu avec celle stockée : une
 *      divergence signifie qu'un ANCIEN token de la famille est rejoué
 *      → compromission présumée, révocation de toute la famille,
 *      audit de sécurité, refus avec REFRESH_TOKEN_REUSE_DETECTED ;
 *   4. vérifie révocation et expiration de la session ;
 *   5. RELIT l'utilisateur en base : compte désactivé ou supprimé
 *      → refus ; sinon son rôle ACTUEL part dans le nouvel access token
 *      (un changement de rôle se propage à la rotation suivante) ;
 *   6. génère un nouveau refresh token et remplace l'empreinte stockée
 *      (rotation), met à jour last_used_at ;
 *   7. renvoie un nouvel access token.
 *
 * Note : le nouveau refresh token conserve la date d'expiration de la
 * session (la rotation ne prolonge pas la durée de vie accordée au login).
 */
@Injectable()
export class RefreshTokensUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepository: AuthSessionRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async execute(refreshToken: string): Promise<RefreshResult> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    const session = await this.sessionRepository.findById(payload.sid);
    if (!session) {
      throw new RefreshTokenInvalidException();
    }

    // Détection de réutilisation AVANT tout : un ancien token rejoué sur
    // une session (même révoquée) révèle une compromission potentielle.
    const receivedHash = this.tokenService.hashRefreshToken(refreshToken);
    if (receivedHash !== session.refreshTokenHash) {
      const revokedCount = await this.sessionRepository.revokeFamily(
        session.tokenFamilyId,
        SessionRevocationReason.TokenReuseDetected,
        new Date(),
      );
      await this.auditService.record({
        category: AuditCategory.Security,
        action: 'auth.refresh-token.reuse-detected',
        actorUserId: session.userId,
        resourceType: 'auth_session',
        resourceId: session.id,
        metadata: {
          tokenFamilyId: session.tokenFamilyId,
          revokedSessions: revokedCount,
        },
      });
      throw new RefreshTokenReuseDetectedException();
    }

    if (session.isRevoked()) {
      throw new SessionRevokedException();
    }
    if (session.isExpired()) {
      throw new SessionExpiredException();
    }

    // Le rôle (et l'état actif) est relu en base à chaque rotation :
    // c'est CE mécanisme qui borne la durée de vie d'un rôle périmé à
    // la durée de vie d'un access token.
    const user = await this.userRepository.findById(session.userId);
    if (!user || !user.isActive) {
      throw new SessionRevokedException();
    }

    const [accessToken, newRefreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(
        session.userId,
        session.id,
        user.role,
      ),
      this.tokenService.generateRefreshToken(session.userId, session.id),
    ]);

    await this.sessionRepository.rotateRefreshToken(
      session.id,
      this.tokenService.hashRefreshToken(newRefreshToken.token),
      new Date(),
    );

    await this.auditService.record({
      category: AuditCategory.Security,
      action: 'auth.token.refreshed',
      actorUserId: session.userId,
      resourceType: 'auth_session',
      resourceId: session.id,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      userId: session.userId,
    };
  }
}
```

> 📌 **D'où vient `USER_REPOSITORY` ici ?** `AuthenticationModule` importe déjà `UsersModule`, qui **exporte** le jeton `USER_REPOSITORY` (regarde `users.module.ts`). L'injection fonctionne donc sans toucher au câblage.

### 6.6 Le guard JWT : exposer le rôle sur `request.user`

### ✏️ Modifier `src/modules/authentication/presentation/jwt-auth.guard.ts`

Seule la fin de `canActivate` change.

**AVANT** :

```typescript
    const payload = await this.tokenService.verifyAccessToken(token);

    request.user = { userId: payload.sub, sessionId: payload.sid };
```

**APRÈS** :

```typescript
    const payload = await this.tokenService.verifyAccessToken(token);

    // Un access token émis AVANT l'ajout des rôles ne porte pas le claim
    // role : il est rejeté comme invalide. Le client obtient alors un
    // jeton conforme via POST /auth/refresh (durée de gêne : quelques
    // minutes au moment du déploiement, aucune ensuite).
    if (!payload.role) {
      throw new AccessTokenInvalidException();
    }

    request.user = {
      userId: payload.sub,
      sessionId: payload.sid,
      role: payload.role,
    };
```

### ✅ Point de contrôle

```bash
npm run build
```

---

## Étape 7 — Le décorateur `@Roles()` et le `RolesGuard`

### Comment fonctionnent un décorateur et un guard NestJS ?

Deux mécanismes complémentaires :

1. **Le décorateur pose des métadonnées.** `@Roles(UserRole.Admin)` n'exécute RIEN au moment de la requête : il attache simplement la liste `[UserRole.Admin]` à la méthode du contrôleur, sous une clé connue (`ROLES_KEY`). C'est un post-it collé sur la route.
2. **Le guard lit les métadonnées et décide.** À chaque requête, `RolesGuard` demande au `Reflector` : « cette route a-t-elle un post-it `roles` ? ». Si oui, il compare avec `request.user.role` (posé par `JwtAuthGuard` juste avant). Si non, il laisse passer — l'authentification seule suffit.

### ➕ Créer `src/common/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

/** Clé des métadonnées lues par RolesGuard. */
export const ROLES_KEY = 'roles';

/**
 * Restreint une route (ou un contrôleur entier) aux rôles listés.
 *
 * Exemple :
 *
 *   @Post()
 *   @Roles(UserRole.Admin)
 *   create(...) { ... }
 *
 * Sans ce décorateur, la route reste accessible à tout utilisateur
 * authentifié (le guard JWT global s'applique toujours).
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
```

### ➕ Créer `src/common/guards/roles.guard.ts`

> Le dossier `src/common/guards/` n'existe pas encore : crée-le.

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithUser } from '../decorators/current-user.decorator';
import { AccessDeniedException } from '../exceptions/app-exceptions';

/**
 * Guard global d'autorisation par rôle.
 *
 * S'exécute APRÈS JwtAuthGuard (ordre d'enregistrement des APP_GUARD) :
 * request.user est donc déjà posé pour toute route protégée.
 *
 * Décision :
 *   - route sans @Roles() : accessible à tout utilisateur authentifié ;
 *   - route avec @Roles(...) : le rôle du JWT doit figurer dans la liste,
 *     sinon 403 ACCESS_DENIED.
 *
 * Le rôle provient du claim `role` du JWT : AUCUNE requête SQL ici.
 * Contrepartie assumée : un changement de rôle prend effet à la
 * prochaine rotation de l'access token (durée de vie courte).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // getAllAndOverride : la métadonnée posée sur la MÉTHODE l'emporte
    // sur celle posée sur la CLASSE (permet un @Roles global au
    // contrôleur, affiné route par route).
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // Pas d'exigence de rôle : l'authentification (JwtAuthGuard) suffit.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // @Roles sur une route @Public est une incohérence de configuration :
    // on refuse plutôt que d'ouvrir la route par accident.
    if (!user) {
      throw new AccessDeniedException();
    }

    if (!requiredRoles.includes(user.role)) {
      throw new AccessDeniedException();
    }

    return true;
  }
}
```

**Ce qu'il faut comprendre :**

- **Pas de hiérarchie implicite** : ADMIN n'est pas « automatiquement » autorisé sur une route `@Roles(Manager)`. Chaque route liste **explicitement** ses rôles (`@Roles(UserRole.Admin, UserRole.Manager)`). C'est plus verbeux mais lisible : la politique d'accès d'une route se lit sur la route.
- Le guard est **synchrone** (pas de `async`) : il ne touche ni la base ni le réseau. C'est tout l'intérêt du rôle dans le JWT.

### ✏️ Modifier `src/modules/authentication/authentication.module.ts` — enregistrement global

**L'ordre des providers `APP_GUARD` détermine l'ordre d'exécution des guards.** On enregistre donc `RolesGuard` juste APRÈS `JwtAuthGuard`, dans le même module — c'est le seul moyen de garantir l'ordre.

**1)** Ajoute l'import :

```typescript
import { RolesGuard } from '../../common/guards/roles.guard';
```

**2)** Dans le tableau `providers`, ajoute le provider juste après celui de `JwtAuthGuard` :

**AVANT** :

```typescript
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
```

**APRÈS** :

```typescript
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // IMPORTANT : après JwtAuthGuard — RolesGuard lit request.user que
    // le guard JWT vient de poser. L'ordre d'enregistrement des
    // APP_GUARD est l'ordre d'exécution.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
```

### ✅ Point de contrôle

```bash
npm run build
```

Puis un test manuel rapide (l'API tournant via `npm run start:dev`) — PowerShell :

```powershell
# Login admin (adapte le port et le mot de passe seedé)
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"TON_MOT_DE_PASSE"}'

# Décoder le payload du JWT pour VOIR le claim role :
$payload = $login.data.accessToken.Split('.')[1]
$payload = $payload.Replace('-','+').Replace('_','/').PadRight([math]::Ceiling($payload.Length/4)*4, '=')
[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload))
```

Tu dois voir `"role":"ADMIN"` dans le JSON du payload. 🎉

> ⚠️ Si tu obtiens 401 avec un token émis AVANT cette étape : c'est le comportement voulu (§6.6). Re-loggue-toi.

---

## Étape 8 — Les cas d'utilisation (use cases)

### Le pattern « un fichier = une action »

Un use case est une classe avec une seule méthode publique `execute()`. Il :
- reçoit des données **déjà validées** (les DTOs ont fait leur travail) ;
- applique les **règles métier** (c'est ici qu'elles vivent, nulle part ailleurs) ;
- parle au repository **via le port** ;
- **journalise** l'action dans l'audit ;
- lève des `AppException` en cas de refus.

Il ne connaît ni Express, ni les DTOs HTTP, ni TypeORM.

### ➕ Créer `src/modules/users/application/list-users.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type {
  ListUsersQuery,
  UserRepositoryPort,
} from '../domain/user-repository.port';

/**
 * Cas d'utilisation : lister les utilisateurs (pagination + filtres).
 *
 * Volontairement mince : la construction de la requête SQL appartient au
 * repository. Le use case reste néanmoins le point d'entrée unique de la
 * couche présentation — si une règle apparaît demain (ex. : un MANAGER
 * ne voit pas les ADMIN), elle se logera ici sans toucher au contrôleur.
 */
@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  execute(query: ListUsersQuery): Promise<PaginatedResult<User>> {
    return this.userRepository.findAll(query);
  }
}
```

### ➕ Créer `src/modules/users/application/create-user.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ResourceAlreadyExistsException } from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { PASSWORD_HASHER } from '../../authentication/domain/password-hasher.port';
import type { PasswordHasherPort } from '../../authentication/domain/password-hasher.port';
import { normalizeEmail, User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
}

/**
 * Cas d'utilisation : créer un utilisateur (réservé ADMIN au niveau
 * du contrôleur).
 *
 * Règles :
 *   - e-mail normalisé puis unicité vérifiée (409 sinon) ;
 *   - mot de passe hashé en Argon2id — jamais stocké ni journalisé
 *     en clair ;
 *   - rôle par défaut : EMPLOYEE (moindre privilège).
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    const email = normalizeEmail(input.email);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ResourceAlreadyExistsException(
        'Un utilisateur avec cet e-mail existe déjà.',
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = await this.userRepository.create({
      email,
      displayName: input.displayName.trim(),
      passwordHash,
      role: input.role ?? UserRole.Employee,
    });

    await this.auditService.record({
      category: AuditCategory.Business,
      action: 'users.created',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return user;
  }
}
```

**Ce qu'il faut comprendre :**

- **Vérification d'unicité en use case ET contrainte unique en base** : la vérification applicative donne un message clair (409 explicite) ; l'index unique SQL reste le filet de sécurité ultime contre les insertions concurrentes.
- **`PASSWORD_HASHER`** est le port de hachage du module d'authentification (implémenté par `Argon2PasswordHasher`). On réutilise le port, pas la classe concrète — le câblage se fait à l'étape 11.
- L'audit ne contient **jamais** le mot de passe — même pas pour le « contexte ».

### ➕ Créer `src/modules/users/application/update-user.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type {
  UpdateUserData,
  UserRepositoryPort,
} from '../domain/user-repository.port';

/** Champs modifiables par cette action (le rôle a son propre use case). */
export interface UpdateUserInput {
  displayName?: string;
  isActive?: boolean;
}

/**
 * Cas d'utilisation : modifier un utilisateur.
 *
 * Sert deux routes :
 *   - PATCH /users/:id (ADMIN) : displayName et/ou isActive ;
 *   - PATCH /users/me (tout connecté) : le contrôleur ne transmet QUE
 *     displayName — l'utilisateur ne peut pas s'auto-(dés)activer.
 *
 * Le changement de rôle passe EXCLUSIVEMENT par ChangeUserRoleUseCase
 * (règle du dernier ADMIN + audit de sécurité dédié).
 */
@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(userId: string, input: UpdateUserInput): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ResourceNotFoundException("L'utilisateur");
    }

    const changes: UpdateUserData = {};
    if (input.displayName !== undefined) {
      changes.displayName = input.displayName.trim();
    }
    if (input.isActive !== undefined) {
      changes.isActive = input.isActive;
    }

    // Rien à modifier : renvoyer l'état courant sans écriture ni audit.
    if (Object.keys(changes).length === 0) {
      return user;
    }

    const updated = await this.userRepository.update(userId, changes);

    await this.auditService.record({
      category: AuditCategory.Business,
      action: 'users.updated',
      resourceType: 'user',
      resourceId: userId,
      metadata: { changes },
    });

    return updated;
  }
}
```

### ➕ Créer `src/modules/users/application/change-user-role.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '../../../common/enums/user-role.enum';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : changer le rôle d'un utilisateur (ADMIN uniquement,
 * imposé par @Roles au niveau du contrôleur).
 *
 * Règle protégée ici (défense en profondeur, même si le guard filtre
 * déjà l'accès) : il doit toujours rester au moins un ADMIN actif.
 * Rétrograder le dernier ADMIN rendrait l'administration de
 * l'application définitivement inaccessible.
 */
@Injectable()
export class ChangeUserRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(targetUserId: string, newRole: UserRole): Promise<User> {
    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new ResourceNotFoundException("L'utilisateur");
    }

    // Aucun changement : sortie silencieuse, pas d'audit parasite.
    if (user.role === newRole) {
      return user;
    }

    const isDemotingAdmin =
      user.role === UserRole.Admin && newRole !== UserRole.Admin;
    if (isDemotingAdmin) {
      const activeAdmins = await this.userRepository.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new BusinessRuleViolationException(
          'Impossible de rétrograder le dernier administrateur actif.',
        );
      }
    }

    const updated = await this.userRepository.update(targetUserId, {
      role: newRole,
    });

    // Catégorie Security : un changement de privilèges est un événement
    // de sécurité, pas une simple donnée métier.
    await this.auditService.record({
      category: AuditCategory.Security,
      action: 'users.role_changed',
      resourceType: 'user',
      resourceId: targetUserId,
      metadata: { from: user.role, to: newRole },
    });

    return updated;
  }
}
```

### ➕ Créer `src/modules/users/application/deactivate-user.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '../../../common/enums/user-role.enum';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : désactiver un utilisateur (soft-delete).
 *
 * Règles :
 *   - interdiction de se désactiver soi-même (un ADMIN étourdi ne doit
 *     pas pouvoir se verrouiller dehors) ;
 *   - le dernier ADMIN actif est intouchable ;
 *   - la ligne n'est jamais détruite : deleted_at + is_active = false.
 *
 * Effet sur les sessions : l'utilisateur désactivé garde un access token
 * valide au plus ~15 minutes ; à la première rotation, le refresh est
 * refusé (RefreshTokensUseCase relit l'état actif en base).
 */
@Injectable()
export class DeactivateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(actor: AuthenticatedUser, targetUserId: string): Promise<void> {
    // SQL Server renvoie les uniqueidentifier en MAJUSCULES alors que le
    // claim JWT porte l'UUID en minuscules : comparaison insensible à la
    // casse obligatoire (même précaution que dans le contrôleur des
    // sessions d'authentification).
    if (actor.userId.toLowerCase() === targetUserId.toLowerCase()) {
      throw new BusinessRuleViolationException(
        'Vous ne pouvez pas désactiver votre propre compte.',
      );
    }

    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new ResourceNotFoundException("L'utilisateur");
    }

    if (user.role === UserRole.Admin) {
      const activeAdmins = await this.userRepository.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new BusinessRuleViolationException(
          'Impossible de désactiver le dernier administrateur actif.',
        );
      }
    }

    await this.userRepository.softDelete(targetUserId);

    await this.auditService.record({
      category: AuditCategory.Security,
      action: 'users.deactivated',
      resourceType: 'user',
      resourceId: targetUserId,
      metadata: { email: user.email, role: user.role },
    });
  }
}
```

**Ce qu'il faut comprendre (sur l'ensemble des use cases) :**

- **Défense en profondeur** : le guard bloque déjà les non-ADMIN, mais les règles critiques (dernier admin, auto-désactivation) sont RE-vérifiées dans le use case. Si demain quelqu'un expose ces use cases par un autre canal (CLI, tâche planifiée, autre contrôleur), les règles tiennent toujours.
- **Catégories d'audit** : `Business` pour le CRUD ordinaire, `Security` pour ce qui touche aux privilèges et aux accès (changement de rôle, désactivation).
- **`GetUserByIdUseCase` existe déjà** et renvoie maintenant le rôle automatiquement (le domaine `User` l'inclut) : rien à faire, la spec est couverte.

### ✅ Point de contrôle

```bash
npm run build
```

---

## Étape 9 — Les DTOs

### À quoi sert un DTO exactement ?

Un DTO (Data Transfer Object) est la **frontière** entre le monde extérieur et ton application :

- **DTOs d'entrée** (`CreateUserDto`…) : décrivent et VALIDENT ce que le client a le droit d'envoyer. Le `ValidationPipe` global les applique automatiquement : propriété inconnue → 400 ; contrainte violée → 400 avec le détail par champ. Les décorateurs `class-validator` (`@IsEmail`, `@IsEnum`…) portent les règles ; `@ApiProperty` documente Swagger.
- **DTOs de sortie** (`UserResponseDto`) : décrivent ce qu'on EXPOSE. C'est notre garde-fou anti-fuite : `passwordHash` n'y figure pas, donc il ne peut pas partir au client, point.

> Le dossier `src/modules/users/presentation/dto/` n'existe pas encore : crée-le.

### ➕ Créer `src/modules/users/presentation/dto/list-users-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';

/**
 * Query string de GET /users.
 *
 * Hérite des paramètres communs du socle (page, limit, sortBy,
 * sortDirection, search) et ajoute les filtres propres au module.
 */
export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtre par rôle.',
    enum: UserRole,
  })
  @IsOptional()
  @IsEnum(UserRole, {
    message: 'Le paramètre "role" doit valoir ADMIN, MANAGER ou EMPLOYEE.',
  })
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Filtre par statut (true = actifs, false = désactivés).',
  })
  @IsOptional()
  // Une query string est toujours du texte : "true"/"false" doivent être
  // convertis à la main. NE PAS utiliser @Type(() => Boolean) : il
  // convertirait la chaîne "false" (non vide) en... true.
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({
    message: 'Le paramètre "isActive" doit valoir true ou false.',
  })
  isActive?: boolean;
}
```

### ➕ Créer `src/modules/users/presentation/dto/create-user.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../../common/enums/user-role.enum';

/** Corps de POST /users (réservé ADMIN). */
export class CreateUserDto {
  @ApiProperty({ example: 'nouvel.employe@entreprise.fr' })
  @IsEmail({}, { message: "L'e-mail est invalide." })
  @MaxLength(320, {
    message: "L'e-mail ne peut pas dépasser 320 caractères.",
  })
  email!: string;

  @ApiProperty({
    description:
      'Au moins 8 caractères, avec majuscule, minuscule, chiffre et symbole.',
    example: 'Erp!2026#demo',
  })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Le mot de passe doit contenir au moins 8 caractères, ' +
        'une majuscule, une minuscule, un chiffre et un symbole.',
    },
  )
  password!: string;

  @ApiProperty({ example: 'Marie Dupont' })
  @IsString()
  @MinLength(1, { message: 'Le nom affiché est obligatoire.' })
  @MaxLength(200, {
    message: 'Le nom affiché ne peut pas dépasser 200 caractères.',
  })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'Rôle initial (EMPLOYEE si absent).',
    enum: UserRole,
    default: UserRole.Employee,
  })
  @IsOptional()
  @IsEnum(UserRole, {
    message: 'Le rôle doit valoir ADMIN, MANAGER ou EMPLOYEE.',
  })
  role?: UserRole;
}
```

### ➕ Créer `src/modules/users/presentation/dto/update-user.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Corps de PATCH /users/:id (réservé ADMIN).
 *
 * Le rôle ne figure PAS ici : il se change via PATCH /users/:id/role,
 * qui applique la règle du dernier administrateur.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Marie Dupont-Martin' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Le nom affiché ne peut pas être vide.' })
  @MaxLength(200, {
    message: 'Le nom affiché ne peut pas dépasser 200 caractères.',
  })
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Réactive (true) ou suspend (false) le compte.',
  })
  @IsOptional()
  @IsBoolean({ message: 'Le champ "isActive" doit valoir true ou false.' })
  isActive?: boolean;
}
```

### ➕ Créer `src/modules/users/presentation/dto/update-my-profile.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Corps de PATCH /users/me.
 *
 * DTO distinct de UpdateUserDto, volontairement : un utilisateur ne peut
 * modifier QUE son nom affiché. Si isActive figurait ici, la whitelist
 * du ValidationPipe ne suffirait plus à empêcher l'auto-réactivation.
 */
export class UpdateMyProfileDto {
  @ApiProperty({ example: 'Marie Dupont' })
  @IsString()
  @MinLength(1, { message: 'Le nom affiché est obligatoire.' })
  @MaxLength(200, {
    message: 'Le nom affiché ne peut pas dépasser 200 caractères.',
  })
  displayName!: string;
}
```

### ➕ Créer `src/modules/users/presentation/dto/change-role.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../../../common/enums/user-role.enum';

/** Corps de PATCH /users/:id/role (réservé ADMIN). */
export class ChangeRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.Manager })
  @IsEnum(UserRole, {
    message: 'Le rôle doit valoir ADMIN, MANAGER ou EMPLOYEE.',
  })
  role!: UserRole;
}
```

### ➕ Créer `src/modules/users/presentation/dto/user-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { User } from '../../domain/user';

/**
 * Représentation publique d'un utilisateur.
 *
 * NE CONTIENT NI passwordHash NI deletedAt : ce qui n'est pas dans ce
 * DTO ne peut pas fuiter, quelle que soit l'évolution du domaine.
 */
export class UserResponseDto {
  @ApiProperty({ description: "Identifiant de l'utilisateur (UUID)." })
  id!: string;

  @ApiProperty({ example: 'marie.dupont@entreprise.fr' })
  email!: string;

  @ApiProperty({ example: 'Marie Dupont' })
  displayName!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.Employee })
  role!: UserRole;

  @ApiProperty({ description: 'False pour un compte suspendu.' })
  isActive!: boolean;

  @ApiProperty({ description: 'Dernière connexion réussie.', nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ description: 'Date de création du compte.' })
  createdAt!: Date;

  /** Conversion domaine -> DTO : le SEUL endroit où l'on choisit ce qui sort. */
  static fromDomain(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.displayName = user.displayName;
    dto.role = user.role;
    dto.isActive = user.isActive;
    dto.lastLoginAt = user.lastLoginAt;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
```

**Ce qu'il faut comprendre :**

- `static fromDomain` centralise la conversion : le contrôleur écrira `UserResponseDto.fromDomain(user)` ou `.map(UserResponseDto.fromDomain)`. Un seul endroit décide de ce qui est exposé.
- Chaque message d'erreur de validation est **en français** : c'est le message que recevra le consommateur de l'API dans `error.details`. Convention du projet (regarde `PaginationQueryDto`).

### ✅ Point de contrôle

```bash
npm run build
```

---

## Étape 10 — Le contrôleur `UsersController`

### Le rôle du contrôleur (et rien d'autre)

Un contrôleur du projet est **mince** : il mappe HTTP ⇄ use case. Pas de règle métier, pas de SQL, pas de try/catch (le filtre global gère les erreurs). Il porte en revanche toute la **documentation Swagger** et les **décorateurs d'accès**.

### ➕ Créer `src/modules/users/presentation/users.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { ChangeUserRoleUseCase } from '../application/change-user-role.use-case';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { DeactivateUserUseCase } from '../application/deactivate-user.use-case';
import { GetUserByIdUseCase } from '../application/get-user-by-id.use-case';
import { ListUsersUseCase } from '../application/list-users.use-case';
import { UpdateUserUseCase } from '../application/update-user.use-case';
import { ChangeRoleDto } from './dto/change-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Contrôleur d'administration des utilisateurs.
 *
 * Volontairement mince : chaque handler délègue à un cas d'utilisation.
 * Les accès sont gouvernés par @Roles (évalué par le RolesGuard global) ;
 * l'authentification est déjà exigée par le guard JWT global.
 *
 * ⚠️ Ordre des routes : /users/me DOIT être déclaré avant /users/:id,
 * sinon Express résout "me" comme un :id (et ParseUUIDPipe répond 400).
 */
@ApiTags('Utilisateurs')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly changeUserRoleUseCase: ChangeUserRoleUseCase,
    private readonly deactivateUserUseCase: DeactivateUserUseCase,
  ) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Liste paginée des utilisateurs',
    description:
      'Filtres : role, isActive, search (e-mail / nom affiché). ' +
      'Tri : sortBy parmi email, displayName, role, isActive, createdAt, ' +
      'lastLoginAt. La pagination est renvoyée dans meta.pagination.',
  })
  @ApiOkResponse({ type: [UserResponseDto] })
  @ApiForbiddenResponse({ description: 'Rôle insuffisant (ACCESS_DENIED).' })
  async list(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const result = await this.listUsersUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      role: query.role,
      isActive: query.isActive,
    });

    return {
      items: result.items.map(UserResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get('me')
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  @ApiOkResponse({ type: UserResponseDto })
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const profile = await this.getUserByIdUseCase.execute(user.userId);
    return UserResponseDto.fromDomain(profile);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Modifier mon nom affiché',
    description:
      'Seul displayName est modifiable par son propriétaire ; le rôle et ' +
      "l'activation relèvent d'un ADMIN.",
  })
  @ApiOkResponse({ type: UserResponseDto })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateMyProfileDto,
  ): Promise<UserResponseDto> {
    const updated = await this.updateUserUseCase.execute(user.userId, {
      displayName: body.displayName,
    });
    return UserResponseDto.fromDomain(updated);
  }

  @Get(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: "Détail d'un utilisateur" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur inconnu ou supprimé.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.getUserByIdUseCase.execute(id);
    return UserResponseDto.fromDomain(user);
  }

  @Post()
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Créer un utilisateur (rôle EMPLOYEE par défaut)' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({
    description: 'E-mail déjà utilisé (RESOURCE_ALREADY_EXISTS).',
  })
  async create(@Body() body: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.createUserUseCase.execute({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      role: body.role,
    });
    return UserResponseDto.fromDomain(user);
  }

  @Patch(':id')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Modifier displayName / isActive' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur inconnu ou supprimé.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updated = await this.updateUserUseCase.execute(id, {
      displayName: body.displayName,
      isActive: body.isActive,
    });
    return UserResponseDto.fromDomain(updated);
  }

  @Patch(':id/role')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: "Changer le rôle d'un utilisateur" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiConflictResponse({
    description:
      'Rétrogradation du dernier ADMIN actif (BUSINESS_RULE_VIOLATION).',
  })
  async changeRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ChangeRoleDto,
  ): Promise<UserResponseDto> {
    const updated = await this.changeUserRoleUseCase.execute(id, body.role);
    return UserResponseDto.fromDomain(updated);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Désactiver un utilisateur (suppression logique)',
    description:
      'Pose deleted_at et is_active = false. Impossible sur soi-même et ' +
      'sur le dernier ADMIN actif.',
  })
  @ApiNoContentResponse({ description: 'Utilisateur désactivé.' })
  @ApiConflictResponse({
    description:
      'Auto-désactivation ou dernier ADMIN (BUSINESS_RULE_VIOLATION).',
  })
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.deactivateUserUseCase.execute(user, id);
  }
}
```

**Ce qu'il faut comprendre :**

- **`@Get('me')` AVANT `@Get(':id')`** : NestJS/Express testent les routes dans l'ordre de déclaration. Si `:id` passait en premier, `GET /users/me` matcherait `:id = "me"` et `ParseUUIDPipe` renverrait un 400 incompréhensible. Piège classique.
- **`ParseUUIDPipe`** : rejette en 400 tout `:id` qui n'est pas un UUID, AVANT d'atteindre le use case. Validation au plus tôt.
- **`@HttpCode(HttpStatus.NO_CONTENT)`** sur le DELETE : NestJS renvoie 200 par défaut ; la spec exige 204 (pas de corps). L'interceptor d'enveloppe laisse les 204 intacts.
- **POST renvoie 201 sans décorateur** : c'est le défaut NestJS pour `@Post()`.

### ✅ Point de contrôle

`npm run build` — le contrôleur n'est pas encore branché (pas dans un module), mais il doit compiler.

---

## Étape 11 — Le câblage du module

### Le point délicat : le hasher sans dépendance circulaire

`CreateUserUseCase` a besoin de `PASSWORD_HASHER`… qui est fourni par `AuthenticationModule`. Or `AuthenticationModule` importe déjà `UsersModule` : si `UsersModule` importait `AuthenticationModule` en retour, on créerait une **dépendance circulaire** (démarrage impossible sans bidouille `forwardRef`).

La solution propre : les providers NestJS sont **par module**. `UsersModule` déclare SON propre binding `{ provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher }`. On importe seulement des *fichiers* (le port et la classe), pas le module — aucun cycle.

### ✏️ Modifier `src/modules/users/users.module.ts`

Remplace tout le fichier :

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { PASSWORD_HASHER } from '../authentication/domain/password-hasher.port';
import { Argon2PasswordHasher } from '../authentication/infrastructure/argon2-password-hasher';
import { ChangeUserRoleUseCase } from './application/change-user-role.use-case';
import { CreateUserUseCase } from './application/create-user.use-case';
import { DeactivateUserUseCase } from './application/deactivate-user.use-case';
import { GetUserByIdUseCase } from './application/get-user-by-id.use-case';
import { ListUsersUseCase } from './application/list-users.use-case';
import { UpdateUserUseCase } from './application/update-user.use-case';
import { USER_REPOSITORY } from './domain/user-repository.port';
import { UserEntity } from './infrastructure/entities/user.entity';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository';
import { UserMapper } from './infrastructure/user.mapper';
import { UsersController } from './presentation/users.controller';

/**
 * Module des utilisateurs techniques.
 *
 * Expose le CRUD d'administration des comptes (rôles ADMIN/MANAGER via
 * RolesGuard) et le self-service /users/me.
 *
 * Le binding PASSWORD_HASHER est déclaré ICI aussi (et pas importé
 * d'AuthenticationModule) : AuthenticationModule importe déjà UsersModule,
 * l'inverse créerait une dépendance circulaire. Seuls le port et
 * l'implémentation (fichiers) sont partagés.
 *
 * Le repository (port USER_REPOSITORY) et GetUserByIdUseCase restent
 * exportés pour le module d'authentification.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), AuditModule],
  controllers: [UsersController],
  providers: [
    UserMapper,
    GetUserByIdUseCase,
    ListUsersUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    ChangeUserRoleUseCase,
    DeactivateUserUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
  ],
  exports: [USER_REPOSITORY, GetUserByIdUseCase],
})
export class UsersModule {}
```

**Ce qu'il faut comprendre :**

- `TypeOrmModule.forFeature([UserEntity])` rend `@InjectRepository(UserEntity)` disponible dans ce module.
- `AuditModule` est importé pour injecter `AuditService` dans les use cases.
- `UsersModule` est déjà importé dans `AppModule` : **rien à toucher là-bas**, les routes `/users` apparaissent dès le redémarrage.

### ✅ Point de contrôle

```bash
npm run build
npm run start:dev
```

Au démarrage, les logs NestJS listent les routes mappées : tu dois voir les 8 routes `/api/v1/users*`. Ouvre aussi Swagger (URL affichée au démarrage) : la section « Utilisateurs » est là, documentée.

---

## Étape 12 — Vérification manuelle & checklist finale

### 12.1 Parcours manuel complet (PowerShell)

L'API tournant (`npm run start:dev`), déroule ce scénario — adapte le port et le mot de passe admin :

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion en ADMIN
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

# 2. Mon profil (le rôle doit apparaître)
Invoke-RestMethod -Uri "$base/users/me" -Headers $headers | ConvertTo-Json -Depth 5

# 3. Créer un utilisateur
$body = '{"email":"test.manuel@local.dev","password":"Erp!2026#demo","displayName":"Test Manuel"}'
$created = Invoke-RestMethod -Method Post -Uri "$base/users" -Headers $headers `
  -ContentType 'application/json' -Body $body
$created.data

# 4. Lister avec filtre
Invoke-RestMethod -Uri "$base/users?role=EMPLOYEE&search=manuel" -Headers $headers |
  ConvertTo-Json -Depth 5

# 5. Le promouvoir MANAGER
Invoke-RestMethod -Method Patch -Uri "$base/users/$($created.data.id)/role" `
  -Headers $headers -ContentType 'application/json' -Body '{"role":"MANAGER"}'

# 6. Vérifier le 403 : connexion avec le compte EMPLOYEE seedé, puis tentative de liste
$loginEmp = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"user@local.dev","password":"MOT_DE_PASSE_USER"}'
try {
  Invoke-RestMethod -Uri "$base/users" `
    -Headers @{ Authorization = "Bearer $($loginEmp.data.accessToken)" }
} catch {
  # Attendu : 403 ACCESS_DENIED
  $_.Exception.Response.StatusCode
}

# 7. Vérifier une règle métier : l'admin tente de SE désactiver
try {
  Invoke-WebRequest -Method Delete -Uri "$base/users/$($login.data.user.id)" `
    -Headers $headers
} catch {
  # Attendu : 409 BUSINESS_RULE_VIOLATION
  $_.Exception.Response.StatusCode
}

# 8. Désactiver l'utilisateur de test
Invoke-WebRequest -Method Delete -Uri "$base/users/$($created.data.id)" `
  -Headers $headers | Select-Object StatusCode   # attendu : 204
```

Vérifie aussi dans **Swagger** (URL affichée au démarrage) : la section « Utilisateurs » documente les 8 routes, avec les schémas des DTOs et les réponses d'erreur.

Enfin, jette un œil au **journal d'audit** en base :

```sql
SELECT TOP 20 action, resource_type, resource_id, actor_user_id, created_at
FROM audit_logs
WHERE action LIKE 'users.%'
ORDER BY created_at DESC;
```

Tu dois y retrouver `users.created`, `users.role_changed`, `users.deactivated` — avec l'ADMIN comme acteur (rempli automatiquement depuis le contexte de requête, sans que nos use cases n'aient rien fait pour).

### 12.2 Checklist finale

```bash
npm run build              # ✅ compile
npm run start:dev          # ✅ les 8 routes /users apparaissent
```

Couverture de la spec `01-users-roles-permissions.md` :

| Exigence de la spec | Réalisé par |
|---|---|
| Enum `UserRole` | Étape 1 (`src/common/enums/user-role.enum.ts`) |
| Champ `role` sur le domaine `User` | Étape 3 |
| `UserRepositoryPort` : `findAll`, `findByEmail`, `create`, `update`, `softDelete` | Étape 5 (+ `countActiveAdmins` pour la règle du dernier admin) |
| Colonne `role` + migration `AddRoleToUsers` | Étape 4 (adaptée SQL Server : `nvarchar` + `DEFAULT`) |
| Mapper à jour | Étape 3 |
| `ListUsersUseCase` (filtres + pagination) | Étape 8 |
| `CreateUserUseCase` (unicité, Argon2id, rôle défaut, audit) | Étape 8 |
| `UpdateUserUseCase` | Étape 8 |
| `ChangeUserRoleUseCase` (dernier ADMIN protégé) | Étape 8 |
| `DeactivateUserUseCase` (soft-delete, pas d'auto-suppression) | Étape 8 |
| `GetUserByIdUseCase` renvoie le rôle | Automatique (domaine enrichi) |
| Décorateur `@Roles()` + `RolesGuard` global | Étape 7 |
| `role` dans le payload JWT (`TokenService`) | Étape 6 |
| DTOs (`CreateUserDto`, `UpdateUserDto`, `ChangeRoleDto`, réponse, page) | Étape 9 (page = `PaginatedResult` + enveloppe) |
| 8 endpoints `/users` avec les bons rôles | Étape 10 |
| Actions d'audit `users.*` | Étape 8 (dans chaque use case) |
| Tests unit / intégration / e2e | ➡️ guide complet `DEV-01-users-roles-permissions.md` |

### 12.3 Ce que tu viens d'apprendre (et qui resservira aux modules 02 → 10)

1. **Le trajet complet d'une fonctionnalité** : domaine → port → migration → adapter → use case → DTO → contrôleur → module. TOUS les modules suivants suivent exactement ce chemin.
2. **`@Roles(...)` est prêt à l'emploi** : les specs 02 à 10 l'utilisent sur chaque route ; il n'y a plus rien à construire côté autorisation.
3. **La pagination du socle** (`PaginationQueryDto` + `PaginatedResult` + helpers) : à réutiliser dans chaque `findAll` — la spec 10 §1 est déjà satisfaite.
4. **Les règles métier vivent dans les use cases**, re-vérifiées même quand un guard filtre déjà (défense en profondeur).
5. **L'audit est explicite** : chaque use case déclare ses événements (`Business` pour le CRUD, `Security` pour les privilèges).
6. **Une migration s'écrit toujours avec son `down()`**.

### 12.4 Pièges rencontrés en route (mémo)

| Piège | Parade |
|---|---|
| `GET /users/me` capté par `GET /users/:id` | Déclarer `me` AVANT `:id` dans le contrôleur |
| `@Type(() => Boolean)` transforme `"false"` en `true` | `@Transform` manuel sur les booléens de query string |
| UUID SQL Server en MAJUSCULES vs claim JWT en minuscules | Comparaisons d'IDs insensibles à la casse |
| Dépendance circulaire Users ↔ Authentication | Binding `PASSWORD_HASHER` déclaré dans les deux modules (fichiers partagés, pas les modules) |
| Anciens access tokens sans claim `role` | Rejetés en 401 ; le client se re-loggue ou refresh |
| La migration donne EMPLOYEE à tout le monde | `UPDATE users SET role='ADMIN' WHERE email='admin@local.dev'` (étape 4.3) |

### 12.5 Ce qui a été volontairement laissé de côté (et où le retrouver)

Cette version allégée s'arrête à « l'application fonctionne ». Le guide complet `DEV-01-users-roles-permissions.md` couvre en plus, aux étapes correspondantes :

- la mise à jour du **seeder** (`run-seed.ts`) pour attribuer les rôles automatiquement ;
- la mise à jour des **fichiers de tests existants** cassés par les nouveaux contrats (constructeur de `User`, port du repository, signature du `TokenService`) ;
- les **tests unitaires** des nouveaux use cases (règle du dernier admin, auto-désactivation, unicité d'e-mail…) ;
- le **test d'intégration** du repository contre la vraie base SQL Server ;
- le **test end-to-end** du parcours complet (403, cycle de vie, protections métier) ;
- la migration de la **base de test** (`npm run migration:run:test`).

À faire absolument avant de considérer le module « terminé » en conditions réelles — mais parfaitement ignorable pour une démonstration.

---

*Fin du guide min-DEV-01. Le module 02 (Contacts) réutilisera : `@Roles`, la pagination, `BusinessRuleViolationException`, le pattern use case + audit.*
