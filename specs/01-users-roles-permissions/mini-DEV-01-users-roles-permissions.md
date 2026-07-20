# mini-DEV-01 · Utilisateurs & Rôles — l'essentiel pour démarrer

> **Spec couverte** : `specs/01-users-roles-permissions.md` (version minimale)
> **Public visé** : quelqu'un qui n'a JAMAIS développé de backend.
> **Promesse** : à la fin de ce guide, tu auras une API de gestion d'utilisateurs avec des rôles (ADMIN / MANAGER / EMPLOYEE), protégée, visible dans Swagger, testable à la souris — où chacun peut changer son mot de passe, où une désactivation par erreur se répare en un appel, et où un admin ne peut pas se verrouiller dehors. Environ 3 à 4 heures de copier-coller commenté.
>
> Il existe trois versions de ce guide, du plus court au plus complet :
> 1. **`mini-`** (celui-ci) : l'essentiel — l'application fonctionne et est déployable chez un petit client.
> 2. **`min-`** : + le rôle embarqué dans le JWT, l'audit, les endpoints de modification de profil.
> 3. **`DEV-01`** (complet) : + les tests automatisés et le seeder.
>
> Tout ce qui est laissé de côté ici est listé à la fin (§ « Ce qu'on verra plus tard »), avec le pointeur vers la version qui le couvre. Rien n'est perdu, tout est différé.

---

## 0 · Démarrer l'environnement

```bash
npm install                # dépendances
npm run docker:db:up       # SQL Server dans Docker
npm run db:init            # crée les bases si besoin
npm run migration:run      # applique les migrations existantes
npm run seed               # crée admin@local.dev et user@local.dev
npm run start:dev          # démarre l'API
```

La console affiche l'URL de l'API : toutes les routes sont préfixées par **`/api/v1`**.

> 💡 Si `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` ne sont pas définis dans ton `.env.local`, le seed affiche des mots de passe générés **une seule fois** dans la console : note-les.

> ⚠️ Cette version ne met pas à jour les fichiers de tests existants (`*.spec.ts`) : après ce guide, `npm run build` et l'application sont parfaits, mais `npm run test:unit` échouera sur quelques anciens tests. C'est assumé — les correctifs sont dans le guide complet.

---

## A · Le socle en 5 idées (2 minutes de lecture)

**1. Chaque module a 4 couches.** `domain/` (les classes métier pures), `application/` (les use cases : un fichier = une action), `infrastructure/` (TypeORM : la vraie base de données), `presentation/` (les contrôleurs HTTP et les DTOs). On code toujours dans cet ordre.

**2. Le domaine définit un contrat, l'infrastructure l'implémente.** `UserRepositoryPort` est une interface ; `TypeOrmUserRepository` est son implémentation. Les use cases ne connaissent que l'interface, injectée via un jeton :

```typescript
constructor(
  @Inject(USER_REPOSITORY)
  private readonly userRepository: UserRepositoryPort,
) {}
```

**3. Une requête traverse une chaîne de protections avant ton code.** Dans l'ordre : le guard JWT (toute route exige un token, sauf `@Public()`), le `RolesGuard` (qu'on va créer), le `ValidationPipe` (rejette tout body/query invalide en 400), puis le contrôleur → le use case. En sortie, un interceptor **enveloppe** automatiquement la réponse :

```jsonc
// Succès :  { "success": true, "data": …, "meta": { "requestId": …, "pagination"?: … } }
// Erreur :  { "success": false, "error": { "code": "ACCESS_DENIED", "message": "…" }, "meta": … }
```

Tu ne construis JAMAIS cette enveloppe toi-même : ton contrôleur retourne l'objet « nu ».

**4. Les erreurs ont un code stable.** On ne lève jamais les exceptions NestJS brutes : on utilise la hiérarchie `AppException` du projet (`ResourceNotFoundException` → 404, etc.). Chaque erreur porte un code technique (`RESOURCE_NOT_FOUND`) sur lequel un front peut s'appuyer, et un message français.

**5. La pagination est déjà prête.** `PaginationQueryDto` (query params `page`, `limit`, `sortBy`, `search`…), `PaginatedResult<T>` (`{ items, meta }`, détecté par l'enveloppe) et des helpers TypeORM sécurisés (tri par liste blanche = anti-injection SQL). On les réutilise, on ne les recrée pas.

**Une particularité à connaître** : la base est **SQL Server** (pas PostgreSQL comme le suggère la spec). Pas de type `enum` natif → le rôle sera stocké en `nvarchar(20)` avec un défaut, comme la colonne `authentication_source` existante.

---

## B · Ce qu'on va construire

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/users` | ADMIN, MANAGER | Liste paginée (filtres `role`, `isActive`, `search`) |
| `GET /api/v1/users/me` | tout connecté | Mon profil |
| `PATCH /api/v1/users/me/password` | tout connecté | Changer son propre mot de passe |
| `GET /api/v1/users/:id` | ADMIN, MANAGER | Détail d'un utilisateur |
| `POST /api/v1/users` | ADMIN | Créer un utilisateur |
| `PATCH /api/v1/users/:id/role` | ADMIN | Changer le rôle |
| `PATCH /api/v1/users/:id/reactivate` | ADMIN | Réactiver un utilisateur désactivé |
| `DELETE /api/v1/users/:id` | ADMIN | Désactiver (soft-delete) |

Trois **garde-fous anti-verrouillage** sont inclus — indispensables dès qu'il y a un vrai client derrière : impossible de se désactiver soi-même, impossible de modifier son propre rôle, impossible de rétrograder ou désactiver le dernier ADMIN actif. Sans eux, une mauvaise manip dans Swagger et plus personne ne peut administrer l'application (réparation uniquement en SQL direct).

**15 fichiers créés, 9 modifiés** — et le cœur de l'authentification (JWT, tokens, login) n'est PAS touché : seul son module NestJS reçoit l'enregistrement du nouveau guard. Dans cette version, le `RolesGuard` lit le rôle en base de données (une petite requête par appel protégé — largement suffisant à cette échelle, et un changement de rôle prend effet immédiatement ; l'optimisation « rôle dans le JWT » est couverte par le guide `min-`).

---

## Étape 1 — L'enum `UserRole`

Trois rôles, définis dans `src/common/` car **tous** les futurs modules (contacts, devis…) les utiliseront.

### ➕ Créer `src/common/enums/user-role.enum.ts` (crée le dossier `enums/`)

```typescript
/**
 * Rôles applicatifs de l'ERP (RBAC simple à trois niveaux).
 *
 * ADMIN    : gestion des utilisateurs et des rôles, suppression de données.
 * MANAGER  : gestion métier courante (contacts, catalogue, devis...).
 * EMPLOYEE : consultation et opérations du quotidien (rôle par défaut).
 *
 * La valeur (chaîne) est stockée telle quelle en base : ne JAMAIS
 * renommer une valeur existante sans migration de données.
 */
export enum UserRole {
  Admin = 'ADMIN',
  Manager = 'MANAGER',
  Employee = 'EMPLOYEE',
}
```

> 💡 Convention du projet : clé PascalCase pour le code (`UserRole.Admin`), valeur SCREAMING_CASE pour la base et l'API (`'ADMIN'`).

**✅ Point de contrôle** : `npm run build`

---

## Étape 2 — Deux nouvelles exceptions

Deux situations à signaler : **403** (rôle insuffisant) et **409** (règle métier violée, ex. : se désactiver soi-même).

### ✏️ Modifier `src/common/exceptions/error-code.enum.ts`

Ajoute deux valeurs à la fin de l'enum, avant le `}` :

```typescript
  AccessDenied = 'ACCESS_DENIED',
  BusinessRuleViolation = 'BUSINESS_RULE_VIOLATION',
```

### ✏️ Modifier `src/common/exceptions/app-exceptions.ts`

Ajoute ces deux classes à la fin du fichier :

```typescript
/**
 * Utilisateur authentifié mais dont le rôle ne permet pas l'action.
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
 * des données interdit l'opération. Le message dit PRÉCISÉMENT quelle
 * règle bloque.
 */
export class BusinessRuleViolationException extends AppException {
  constructor(message: string) {
    super(ErrorCode.BusinessRuleViolation, message, HttpStatus.CONFLICT);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 3 — Le domaine : ajouter `role` à `User`

Le modèle de domaine est LA représentation métier : on commence toujours par lui. Sa classe est immuable (constructeur positionnel `readonly`) : ajouter un paramètre fait volontairement casser la compilation partout où un `User` est construit — TypeScript nous donne la liste des points à corriger (ici : le mapper, corrigé à l'étape 4).

### ✏️ Modifier `src/modules/users/domain/user.ts` — remplace tout le fichier

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

> 📌 `role` est inséré **après `authenticationSource`**, **avant `isActive`** : le mapper doit respecter cet ordre.

### ✏️ Modifier `src/modules/users/infrastructure/user.mapper.ts` — remplace tout le fichier

```typescript
import { Injectable } from '@nestjs/common';
import { User } from '../domain/user';
import { UserEntity } from './entities/user.entity';

/**
 * Conversion entité TypeORM <-> modèle de domaine.
 * Le domaine ne voit jamais l'entité TypeORM.
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

> ⚠️ `entity.role` n'existe pas encore → **erreur de compilation attendue** jusqu'à l'étape 4. C'est le seul moment du guide où c'est normal.

---

## Étape 4 — L'entité TypeORM + la migration

### ✏️ Modifier `src/modules/users/infrastructure/entities/user.entity.ts`

Deux retouches : l'import, et la colonne.

**1)** Ajoute l'import en haut :

```typescript
import { UserRole } from '../../../../common/enums/user-role.enum';
```

**2)** Ajoute cette propriété dans la classe, entre `authenticationSource` et `isActive` :

```typescript
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
```

### La migration

L'entité décrit l'état cible ; c'est la **migration** qui modifie réellement la base (jamais de `synchronize: true` dans ce projet). Génère le squelette :

```bash
npm run migration:create -- src/database/migrations/AddRoleToUsers
```

### ✏️ Compléter le fichier `<timestamp>-AddRoleToUsers.ts` généré

**Garde le nom de classe généré** (avec SON timestamp) et remplis `up`/`down` :

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleToUsers1234567890123 implements MigrationInterface {
  name = 'AddRoleToUsers1234567890123'; // ← garde le timestamp généré chez toi

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Contrainte DEFAULT nommée : indispensable pour pouvoir la
    // supprimer proprement dans down() (SQL Server).
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" nvarchar(20) NOT NULL ` +
        `CONSTRAINT "DF_users_role" DEFAULT 'EMPLOYEE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "DF_users_role"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
  }
}
```

Applique-la, puis promeus l'administrateur (la migration a donné `EMPLOYEE` à tout le monde — personne ne devient ADMIN par accident) :

```bash
npm run migration:run
```

```sql
-- Via ton client SQL (Azure Data Studio / SSMS) :
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@local.dev';
```

**✅ Point de contrôle** : `npm run build` repasse au vert, et `admin@local.dev` a `role = 'ADMIN'` en base.

---

## Étape 5 — Le repository : port + implémentation

Le port actuel ne sait que lire. On ajoute : lister (paginé, filtré), créer, modifier, désactiver. **D'abord le contrat (domaine), ensuite l'implémentation (infrastructure).**

### ✏️ Modifier `src/modules/users/domain/user-repository.port.ts` — remplace tout le fichier

```typescript
import { UserRole } from '../../../common/enums/user-role.enum';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { User } from './user';

/** Critères de listing des utilisateurs. */
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
 * Défini dans le domaine, implémenté par l'infrastructure TypeORM.
 * Les recherches excluent les utilisateurs supprimés logiquement —
 * sauf la variante IncludingDeleted, qui sert justement à les retrouver.
 */
export interface UserRepositoryPort {
  /** Liste paginée et filtrée. */
  findAll(query: ListUsersQuery): Promise<PaginatedResult<User>>;

  /** Recherche par identifiant ; null si inconnu ou supprimé. */
  findById(id: string): Promise<User | null>;

  /**
   * Recherche par identifiant, Y COMPRIS les comptes supprimés
   * logiquement. Sert uniquement à la réactivation.
   */
  findByIdIncludingDeleted(id: string): Promise<User | null>;

  /** Recherche par e-mail (déjà normalisé) ; null si inconnu ou supprimé. */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Nombre d'administrateurs actifs (non supprimés, is_active = true).
   * Sert aux garde-fous « dernier ADMIN ».
   */
  countActiveAdmins(): Promise<number>;

  /** Crée un utilisateur local actif et le renvoie. */
  create(data: CreateUserData): Promise<User>;

  /** Applique les champs fournis et renvoie l'utilisateur à jour. */
  update(id: string, data: UpdateUserData): Promise<User>;

  /** Remplace le hash du mot de passe (hash DÉJÀ calculé par l'appelant). */
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;

  /** Suppression logique : pose deleted_at ET is_active = false. */
  softDelete(id: string): Promise<void>;

  /** Annule la suppression logique ET réactive le compte. */
  restore(id: string): Promise<void>;

  /** Met à jour la date de dernière connexion. */
  updateLastLoginAt(id: string, lastLoginAt: Date): Promise<void>;
}

/** Jeton d'injection du repository utilisateurs. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
```

### ✏️ Modifier `src/modules/users/infrastructure/typeorm-user.repository.ts` — remplace tout le fichier

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

  async findByIdIncludingDeleted(id: string): Promise<User | null> {
    // withDeleted lève le filtre automatique sur deleted_at : c'est le
    // SEUL moyen de retrouver un compte désactivé pour le réactiver.
    const entity = await this.repository.findOne({
      where: { id },
      withDeleted: true,
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repository.findOne({ where: { email } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async countActiveAdmins(): Promise<number> {
    // count() ignore les lignes soft-deletées (comportement TypeORM) :
    // on ne compte donc que les admins réellement capables de se connecter.
    return this.repository.count({
      where: { role: UserRole.Admin, isActive: true },
    });
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

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.repository.update({ id }, { passwordHash });
  }

  async softDelete(id: string): Promise<void> {
    // is_active = false AVANT le soft-delete : une ligne restaurée un
    // jour ne doit pas revenir active par surprise.
    await this.repository.update({ id }, { isActive: false });
    await this.repository.softDelete({ id });
  }

  async restore(id: string): Promise<void> {
    // restore() remet deleted_at à NULL ; on réactive ensuite le compte
    // (softDelete l'avait volontairement passé à is_active = false).
    await this.repository.restore({ id });
    await this.repository.update({ id }, { isActive: true });
  }

  async updateLastLoginAt(id: string, lastLoginAt: Date): Promise<void> {
    await this.repository.update({ id }, { lastLoginAt });
  }
}
```

**À retenir :**
- `'user.isActive'` = la *propriété* TypeScript ; TypeORM la traduit lui-même en colonne `is_active`.
- Les valeurs passent TOUJOURS par des paramètres nommés (`:role`) — jamais de concaténation → pas d'injection SQL.

**✅ Point de contrôle** : `npm run build`

---

## Étape 6 — Le décorateur `@Roles()` et le `RolesGuard`

Deux mécanismes complémentaires :

1. **Le décorateur pose un « post-it »** sur la route : `@Roles(UserRole.Admin)` attache la liste `[ADMIN]` comme métadonnée. Il n'exécute rien.
2. **Le guard lit le post-it et décide.** À chaque requête, il vérifie : la route exige-t-elle des rôles ? Si oui, il charge l'utilisateur en base et compare son rôle. Si non, il laisse passer (l'authentification JWT suffit).

> 💡 **Choix de cette version** : le guard lit le rôle **en base de données** (une petite requête par appel protégé). C'est simple et toujours à jour. Le guide `min-` remplace ça par le rôle embarqué dans le JWT (zéro requête SQL, mais 6 fichiers d'authentification à modifier) — une optimisation, pas un prérequis.

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

### ➕ Créer `src/common/guards/roles.guard.ts` (crée le dossier `guards/`)

```typescript
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithUser } from '../decorators/current-user.decorator';
import { AccessDeniedException } from '../exceptions/app-exceptions';
import { USER_REPOSITORY } from '../../modules/users/domain/user-repository.port';
import type { UserRepositoryPort } from '../../modules/users/domain/user-repository.port';

/**
 * Guard global d'autorisation par rôle.
 *
 * S'exécute APRÈS JwtAuthGuard (ordre d'enregistrement des APP_GUARD) :
 * request.user est donc déjà posé pour toute route protégée.
 *
 * Décision :
 *   - route sans @Roles() : accessible à tout utilisateur authentifié,
 *     AUCUNE requête SQL n'est faite ;
 *   - route avec @Roles(...) : l'utilisateur est rechargé en base et son
 *     rôle doit figurer dans la liste, sinon 403 ACCESS_DENIED.
 *
 * Version volontairement simple : le rôle est lu en base à chaque appel
 * protégé — toujours exact, au prix d'une requête. L'optimisation
 * consistant à embarquer le rôle dans le JWT est décrite dans le guide
 * min-DEV-01 (étape 6).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride : la métadonnée posée sur la MÉTHODE l'emporte
    // sur celle posée sur la CLASSE.
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

    // Rôle relu en base : un changement de rôle prend effet immédiatement.
    const account = await this.userRepository.findById(user.userId);
    if (!account || !requiredRoles.includes(account.role)) {
      throw new AccessDeniedException();
    }

    return true;
  }
}
```

### ✏️ Modifier `src/modules/authentication/authentication.module.ts` — enregistrement global

**L'ordre des providers `APP_GUARD` détermine l'ordre d'exécution des guards** : `RolesGuard` doit venir juste APRÈS `JwtAuthGuard` (il lit `request.user` que le guard JWT vient de poser).

**1)** Ajoute l'import :

```typescript
import { RolesGuard } from '../../common/guards/roles.guard';
```

**2)** Dans le tableau `providers` :

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
    // le guard JWT vient de poser.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
```

> 📌 **D'où vient `USER_REPOSITORY` pour le guard ?** `AuthenticationModule` importe déjà `UsersModule`, qui exporte ce jeton. Aucun câblage supplémentaire.

**✅ Point de contrôle** : `npm run build`

---

## Étape 7 — Les cas d'utilisation (use cases)

Un use case = une classe, une méthode `execute()`, une action métier. Il reçoit des données déjà validées (par les DTOs, étape 8), applique les règles, parle au repository via le port. Il ne connaît ni HTTP ni TypeORM.

> `GetUserByIdUseCase` existe déjà et renvoie maintenant le rôle automatiquement (le domaine l'inclut) : rien à faire pour lui.

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
 * couche présentation — si une règle métier apparaît demain, elle se
 * logera ici sans toucher au contrôleur.
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
 *   - mot de passe hashé en Argon2id — jamais stocké en clair ;
 *   - rôle par défaut : EMPLOYEE (moindre privilège).
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
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

    return this.userRepository.create({
      email,
      displayName: input.displayName.trim(),
      passwordHash,
      role: input.role ?? UserRole.Employee,
    });
  }
}
```

> 💡 **`PASSWORD_HASHER`** est le port de hachage du module d'authentification (implémenté par `Argon2PasswordHasher`). On réutilise le port et la classe — le câblage se fait à l'étape 10, SANS importer `AuthenticationModule` (ce serait une dépendance circulaire, il importe déjà `UsersModule`).

### ➕ Créer `src/modules/users/application/change-user-role.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '../../../common/enums/user-role.enum';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : changer le rôle d'un utilisateur (ADMIN uniquement,
 * imposé par @Roles au niveau du contrôleur).
 *
 * Deux garde-fous anti-verrouillage :
 *   - interdiction de modifier son PROPRE rôle : un admin qui se
 *     rétrograde perdrait l'accès à l'administration à l'appel suivant ;
 *   - interdiction de rétrograder le DERNIER admin actif : plus personne
 *     ne pourrait administrer l'application (réparation en SQL direct).
 */
@Injectable()
export class ChangeUserRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    targetUserId: string,
    newRole: UserRole,
  ): Promise<User> {
    // UUID SQL Server en MAJUSCULES vs JWT en minuscules : comparaison
    // insensible à la casse (même piège qu'à la désactivation).
    if (actor.userId.toLowerCase() === targetUserId.toLowerCase()) {
      throw new BusinessRuleViolationException(
        'Vous ne pouvez pas modifier votre propre rôle.',
      );
    }

    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new ResourceNotFoundException("L'utilisateur");
    }

    // Aucun changement : sortie silencieuse, pas d'écriture inutile.
    if (user.role === newRole) {
      return user;
    }

    // Rétrograder le dernier admin actif verrouillerait l'administration.
    if (
      user.role === UserRole.Admin &&
      user.isActive &&
      (await this.userRepository.countActiveAdmins()) <= 1
    ) {
      throw new BusinessRuleViolationException(
        'Impossible de rétrograder le dernier administrateur actif.',
      );
    }

    return this.userRepository.update(targetUserId, { role: newRole });
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
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : désactiver un utilisateur (soft-delete).
 *
 * Deux garde-fous anti-verrouillage :
 *   - interdiction de se désactiver soi-même — un ADMIN étourdi ne doit
 *     pas pouvoir se verrouiller dehors ;
 *   - interdiction de désactiver le dernier ADMIN actif — plus personne
 *     ne pourrait administrer l'application.
 */
@Injectable()
export class DeactivateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(actor: AuthenticatedUser, targetUserId: string): Promise<void> {
    // SQL Server renvoie les uniqueidentifier en MAJUSCULES alors que le
    // JWT porte l'UUID en minuscules : comparaison insensible à la casse.
    if (actor.userId.toLowerCase() === targetUserId.toLowerCase()) {
      throw new BusinessRuleViolationException(
        'Vous ne pouvez pas désactiver votre propre compte.',
      );
    }

    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new ResourceNotFoundException("L'utilisateur");
    }

    // Désactiver le dernier admin actif verrouillerait l'administration.
    if (
      user.role === UserRole.Admin &&
      user.isActive &&
      (await this.userRepository.countActiveAdmins()) <= 1
    ) {
      throw new BusinessRuleViolationException(
        'Impossible de désactiver le dernier administrateur actif.',
      );
    }

    await this.userRepository.softDelete(targetUserId);
  }
}
```

### ➕ Créer `src/modules/users/application/reactivate-user.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : réactiver un utilisateur désactivé (ADMIN
 * uniquement, imposé par @Roles au niveau du contrôleur).
 *
 * Pendant inverse de DeactivateUserUseCase : efface deleted_at et remet
 * is_active = true. Sans lui, une désactivation par erreur ne se répare
 * qu'en SQL direct — inacceptable une fois déployé chez un client.
 */
@Injectable()
export class ReactivateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(targetUserId: string): Promise<User> {
    // findById ne voit pas les comptes soft-deletés : il faut la
    // variante IncludingDeleted pour retrouver la cible.
    const user =
      await this.userRepository.findByIdIncludingDeleted(targetUserId);
    if (!user) {
      throw new ResourceNotFoundException("L'utilisateur");
    }

    // Déjà actif : sortie silencieuse (l'appel est idempotent).
    if (user.deletedAt === null && user.isActive) {
      return user;
    }

    await this.userRepository.restore(targetUserId);

    // La ligne vient d'être restaurée : findById la retrouve forcément.
    return (await this.userRepository.findById(targetUserId)) as User;
  }
}
```

### ➕ Créer `src/modules/users/application/change-my-password.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { PASSWORD_HASHER } from '../../authentication/domain/password-hasher.port';
import type { PasswordHasherPort } from '../../authentication/domain/password-hasher.port';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : changer SON PROPRE mot de passe (tout utilisateur
 * connecté — la cible est toujours l'appelant, jamais un tiers).
 *
 * Règles :
 *   - le mot de passe ACTUEL doit être fourni et correct : trouver un
 *     poste déverrouillé ne suffit pas à s'approprier le compte ;
 *   - le nouveau mot de passe est hashé en Argon2id (jamais de clair en
 *     base), sa force est validée par le DTO.
 *
 * Limite assumée de cette version : les AUTRES sessions déjà ouvertes
 * restent valides après le changement (les révoquer touche au module
 * d'authentification — voir § « Ce qu'on verra plus tard »).
 */
@Injectable()
export class ChangeMyPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(actor.userId);

    // Un compte SSO n'a pas de mot de passe local à changer.
    if (!user || user.passwordHash === null) {
      throw new BusinessRuleViolationException(
        "Ce compte n'a pas de mot de passe local.",
      );
    }

    const currentIsValid = await this.passwordHasher.verify(
      user.passwordHash,
      currentPassword,
    );
    if (!currentIsValid) {
      // 409 plutôt que 401 : un 401 ferait déconnecter l'utilisateur par
      // la plupart des fronts, alors qu'il est bien authentifié — il
      // s'est juste trompé de mot de passe actuel.
      throw new BusinessRuleViolationException(
        'Le mot de passe actuel est incorrect.',
      );
    }

    const newPasswordHash = await this.passwordHasher.hash(newPassword);
    await this.userRepository.updatePasswordHash(actor.userId, newPasswordHash);
  }
}
```

> 💡 Ce use case tient entièrement dans le module users : le binding
> `PASSWORD_HASHER` y est déjà déclaré (étape 10) pour `CreateUserUseCase`.
> Le module d'authentification n'est pas touché.

**✅ Point de contrôle** : `npm run build`

---

## Étape 8 — Les DTOs

Les DTOs sont la **frontière** avec l'extérieur :
- en **entrée**, ils valident (le `ValidationPipe` global rejette en 400 toute propriété inconnue ou contrainte violée) ;
- en **sortie**, ils choisissent ce qui est exposé — `passwordHash` n'y figure pas, donc il ne peut PAS fuiter.

> Crée le dossier `src/modules/users/presentation/dto/`.

### ➕ Créer `src/modules/users/presentation/dto/list-users-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';

/**
 * Query string de GET /users.
 * Hérite des paramètres communs du socle (page, limit, sortBy,
 * sortDirection, search) et ajoute les filtres propres au module.
 */
export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtre par rôle.', enum: UserRole })
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

### ➕ Créer `src/modules/users/presentation/dto/change-my-password.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword, MinLength } from 'class-validator';

/** Corps de PATCH /users/me/password (tout utilisateur connecté). */
export class ChangeMyPasswordDto {
  @ApiProperty({
    description: 'Mot de passe actuel, vérifié avant tout changement.',
  })
  @IsString()
  @MinLength(1, { message: 'Le mot de passe actuel est obligatoire.' })
  currentPassword!: string;

  @ApiProperty({
    description:
      'Au moins 8 caractères, avec majuscule, minuscule, chiffre et symbole.',
    example: 'Erp!2027#neuf',
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
        'Le nouveau mot de passe doit contenir au moins 8 caractères, ' +
        'une majuscule, une minuscule, un chiffre et un symbole.',
    },
  )
  newPassword!: string;
}
```

> 📌 Mêmes exigences de force que `CreateUserDto` : un mot de passe ne
> doit pas pouvoir s'affaiblir en étant changé.

### ➕ Créer `src/modules/users/presentation/dto/user-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { User } from '../../domain/user';

/**
 * Représentation publique d'un utilisateur.
 * NE CONTIENT NI passwordHash NI deletedAt : ce qui n'est pas dans ce
 * DTO ne peut pas fuiter.
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

**✅ Point de contrôle** : `npm run build`

---

## Étape 9 — Le contrôleur

Le contrôleur est **mince** : il mappe HTTP ⇄ use case. Pas de logique métier, pas de try/catch (le filtre global convertit les exceptions). Il porte la documentation Swagger et les décorateurs d'accès.

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
import { ChangeMyPasswordUseCase } from '../application/change-my-password.use-case';
import { ChangeUserRoleUseCase } from '../application/change-user-role.use-case';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { DeactivateUserUseCase } from '../application/deactivate-user.use-case';
import { GetUserByIdUseCase } from '../application/get-user-by-id.use-case';
import { ListUsersUseCase } from '../application/list-users.use-case';
import { ReactivateUserUseCase } from '../application/reactivate-user.use-case';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Contrôleur d'administration des utilisateurs.
 *
 * Volontairement mince : chaque handler délègue à un cas d'utilisation.
 * Les accès sont gouvernés par @Roles (évalué par le RolesGuard global) ;
 * l'authentification est déjà exigée par le guard JWT global.
 *
 * ⚠️ Ordre des routes : les routes /users/me et /users/me/password
 * DOIVENT être déclarées avant /users/:id, sinon Express résout "me"
 * comme un :id (et ParseUUIDPipe répond 400).
 */
@ApiTags('Utilisateurs')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly changeUserRoleUseCase: ChangeUserRoleUseCase,
    private readonly changeMyPasswordUseCase: ChangeMyPasswordUseCase,
    private readonly deactivateUserUseCase: DeactivateUserUseCase,
    private readonly reactivateUserUseCase: ReactivateUserUseCase,
  ) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Liste paginée des utilisateurs',
    description:
      'Filtres : role, isActive, search (e-mail / nom affiché). ' +
      'La pagination est renvoyée dans meta.pagination.',
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

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Changer son propre mot de passe',
    description:
      "Exige le mot de passe actuel. Ne concerne QUE l'utilisateur " +
      'connecté : un admin ne change jamais le mot de passe des autres.',
  })
  @ApiNoContentResponse({ description: 'Mot de passe changé.' })
  @ApiConflictResponse({
    description:
      'Mot de passe actuel incorrect, ou compte sans mot de passe local ' +
      '(BUSINESS_RULE_VIOLATION).',
  })
  async changeMyPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangeMyPasswordDto,
  ): Promise<void> {
    await this.changeMyPasswordUseCase.execute(
      user,
      body.currentPassword,
      body.newPassword,
    );
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

  @Patch(':id/role')
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: "Changer le rôle d'un utilisateur",
    description:
      'Impossible sur soi-même, et impossible de rétrograder le dernier ' +
      'ADMIN actif.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur inconnu ou supprimé.' })
  @ApiConflictResponse({
    description:
      'Propre rôle ou dernier ADMIN actif (BUSINESS_RULE_VIOLATION).',
  })
  async changeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ChangeRoleDto,
  ): Promise<UserResponseDto> {
    const updated = await this.changeUserRoleUseCase.execute(
      user,
      id,
      body.role,
    );
    return UserResponseDto.fromDomain(updated);
  }

  @Patch(':id/reactivate')
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'Réactiver un utilisateur désactivé',
    description:
      'Efface deleted_at et remet is_active = true. Idempotent : ' +
      'réactiver un compte déjà actif renvoie simplement son état.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur inconnu.' })
  async reactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.reactivateUserUseCase.execute(id);
    return UserResponseDto.fromDomain(user);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Désactiver un utilisateur (suppression logique)',
    description: 'Pose deleted_at et is_active = false. Impossible sur soi-même.',
  })
  @ApiNoContentResponse({ description: 'Utilisateur désactivé.' })
  @ApiConflictResponse({
    description: 'Auto-désactivation (BUSINESS_RULE_VIOLATION).',
  })
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.deactivateUserUseCase.execute(user, id);
  }
}
```

**À retenir :**
- **`@Get('me')` et `@Patch('me/password')` AVANT les routes `:id`** : les routes sont testées dans l'ordre de déclaration — piège classique.
- **`PATCH /users/me/password` renvoie 204 sans body** : rien d'utile à renvoyer, et surtout JAMAIS le nouveau hash.
- **`ParseUUIDPipe`** : rejette en 400 tout `:id` non-UUID avant même d'atteindre le use case.
- **`@HttpCode(HttpStatus.NO_CONTENT)`** : la spec exige 204 sur le DELETE (défaut NestJS : 200). Le POST renvoie 201 sans décorateur (défaut NestJS pour `@Post()`).

**✅ Point de contrôle** : `npm run build`

---

## Étape 10 — Le câblage du module

Dernière pièce : déclarer tout ça dans `UsersModule`.

**Le point délicat** : `CreateUserUseCase` a besoin de `PASSWORD_HASHER`, fourni par `AuthenticationModule`… qui importe déjà `UsersModule`. Importer l'inverse créerait une **dépendance circulaire**. Solution propre : les providers NestJS sont par module — `UsersModule` déclare SON propre binding vers la même classe `Argon2PasswordHasher` (on partage des *fichiers*, pas des modules).

### ✏️ Modifier `src/modules/users/users.module.ts` — remplace tout le fichier

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PASSWORD_HASHER } from '../authentication/domain/password-hasher.port';
import { Argon2PasswordHasher } from '../authentication/infrastructure/argon2-password-hasher';
import { ChangeMyPasswordUseCase } from './application/change-my-password.use-case';
import { ChangeUserRoleUseCase } from './application/change-user-role.use-case';
import { CreateUserUseCase } from './application/create-user.use-case';
import { DeactivateUserUseCase } from './application/deactivate-user.use-case';
import { GetUserByIdUseCase } from './application/get-user-by-id.use-case';
import { ListUsersUseCase } from './application/list-users.use-case';
import { ReactivateUserUseCase } from './application/reactivate-user.use-case';
import { USER_REPOSITORY } from './domain/user-repository.port';
import { UserEntity } from './infrastructure/entities/user.entity';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository';
import { UserMapper } from './infrastructure/user.mapper';
import { UsersController } from './presentation/users.controller';

/**
 * Module des utilisateurs techniques.
 *
 * Expose le CRUD d'administration des comptes (rôles ADMIN/MANAGER via
 * RolesGuard) et le self-service GET /users/me.
 *
 * Le binding PASSWORD_HASHER est déclaré ICI aussi (et pas importé
 * d'AuthenticationModule) : AuthenticationModule importe déjà UsersModule,
 * l'inverse créerait une dépendance circulaire.
 *
 * Le repository (port USER_REPOSITORY) et GetUserByIdUseCase restent
 * exportés pour le module d'authentification (et pour RolesGuard).
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [
    UserMapper,
    GetUserByIdUseCase,
    ListUsersUseCase,
    CreateUserUseCase,
    ChangeUserRoleUseCase,
    ChangeMyPasswordUseCase,
    DeactivateUserUseCase,
    ReactivateUserUseCase,
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

> `UsersModule` est déjà importé dans `AppModule` : rien d'autre à toucher, les routes apparaissent au redémarrage.

**✅ Point de contrôle** :

```bash
npm run build
npm run start:dev
```

Les logs de démarrage listent les 8 routes `/api/v1/users*`, et Swagger affiche la section « Utilisateurs ».

---

## Étape 11 — Vérifier que ça marche 🎉

L'API tournant, déroule ce scénario en PowerShell (adapte le port et le mot de passe admin) :

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion en ADMIN
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

# 2. Mon profil (le rôle ADMIN doit apparaître)
Invoke-RestMethod -Uri "$base/users/me" -Headers $headers | ConvertTo-Json -Depth 5

# 3. Créer un utilisateur
$body = '{"email":"test.manuel@local.dev","password":"Erp!2026#demo","displayName":"Test Manuel"}'
$created = Invoke-RestMethod -Method Post -Uri "$base/users" -Headers $headers `
  -ContentType 'application/json' -Body $body
$created.data

# 4. Lister avec filtres (regarde meta.pagination dans la réponse)
Invoke-RestMethod -Uri "$base/users?role=EMPLOYEE&search=manuel" -Headers $headers |
  ConvertTo-Json -Depth 5

# 5. Le promouvoir MANAGER
Invoke-RestMethod -Method Patch -Uri "$base/users/$($created.data.id)/role" `
  -Headers $headers -ContentType 'application/json' -Body '{"role":"MANAGER"}'

# 6. Le 403 en action : le compte EMPLOYEE seedé tente de lister
$loginEmp = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"user@local.dev","password":"MOT_DE_PASSE_USER"}'
try {
  Invoke-RestMethod -Uri "$base/users" `
    -Headers @{ Authorization = "Bearer $($loginEmp.data.accessToken)" }
} catch {
  $_.Exception.Response.StatusCode   # attendu : Forbidden (403)
}

# 7. La règle métier en action : l'admin tente de SE désactiver
try {
  Invoke-WebRequest -Method Delete -Uri "$base/users/$($login.data.user.id)" `
    -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 8. Le garde-fou anti-verrouillage : l'admin tente de changer SON rôle
try {
  Invoke-RestMethod -Method Patch -Uri "$base/users/$($login.data.user.id)/role" `
    -Headers $headers -ContentType 'application/json' -Body '{"role":"EMPLOYEE"}'
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 9. Désactiver l'utilisateur de test (204 attendu)
Invoke-WebRequest -Method Delete -Uri "$base/users/$($created.data.id)" `
  -Headers $headers | Select-Object StatusCode

# 10. Le réactiver : la désactivation n'est pas une impasse
Invoke-RestMethod -Method Patch -Uri "$base/users/$($created.data.id)/reactivate" `
  -Headers $headers | ConvertTo-Json -Depth 5   # isActive doit revenir à true

# 11. Changement de mot de passe : l'utilisateur de test change le sien...
$loginTest = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"test.manuel@local.dev","password":"Erp!2026#demo"}'
Invoke-WebRequest -Method Patch -Uri "$base/users/me/password" `
  -Headers @{ Authorization = "Bearer $($loginTest.data.accessToken)" } `
  -ContentType 'application/json' `
  -Body '{"currentPassword":"Erp!2026#demo","newPassword":"Erp!2027#neuf"}' |
  Select-Object StatusCode                       # attendu : 204

# ... et se reconnecte avec le nouveau (l'ancien ne marche plus)
Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"test.manuel@local.dev","password":"Erp!2027#neuf"}' | Out-Null
"Reconnexion avec le nouveau mot de passe : OK"
```

Tu peux faire exactement le même parcours **à la souris dans Swagger** (bouton « Authorize » avec le token de login) — c'est souvent plus parlant pour une démo.

### Les pièges croisés en route (mémo)

| Piège | Parade |
|---|---|
| `GET /users/me` capté par `GET /users/:id` | Déclarer `me` AVANT `:id` dans le contrôleur |
| `@Type(() => Boolean)` transforme `"false"` en `true` | `@Transform` manuel sur les booléens de query string |
| UUID SQL Server en MAJUSCULES vs JWT en minuscules | Comparaisons d'IDs insensibles à la casse |
| Dépendance circulaire Users ↔ Authentication | Binding `PASSWORD_HASHER` déclaré dans les deux modules |
| Un compte soft-deleté est invisible pour TypeORM (`findOne` le rate) | `withDeleted: true` dans `findByIdIncludingDeleted` |
| Mauvais mot de passe actuel : 401 déconnecterait l'utilisateur côté front | 409 `BUSINESS_RULE_VIOLATION` (l'utilisateur EST authentifié) |
| La migration donne EMPLOYEE à tout le monde | `UPDATE users SET role='ADMIN' WHERE email='admin@local.dev'` |

---

## Ce qu'on verra plus tard (rien n'est perdu)

La plupart des éléments différés sont couverts, prêts à copier-coller, dans une version plus complète du guide ; les deux chantiers liés au module d'authentification sont signalés honnêtement comme restant à écrire :

| Différé | Pourquoi ce n'est pas bloquant | Où le trouver |
|---|---|---|
| **Rôle dans le JWT** (au lieu de la requête SQL du guard) | Pure optimisation : le guard actuel est correct, juste un peu moins rapide | `min-DEV-01`, étape 6 |
| **Endpoints de modification de profil** (`PATCH /users/:id`, `PATCH /users/me`) | Corriger un nom affiché attendra ; c'est un use case + 2 DTOs de plus | `min-DEV-01`, étapes 8–10 |
| **Révocation des autres sessions après changement de mot de passe** | La session volée reste valide jusqu'à son expiration — fenêtre courte et bornée | Chantier du module authentification (aucune version du guide 01 ne le couvre encore) |
| **Mot de passe oublié** (réinitialisation par e-mail) | En attendant, un ADMIN désactive le compte et en recrée un | Chantier à part (modules auth + mail), hors guides 01 |
| **Audit** (`users.created`, `users.role_changed`…) | Le journal d'audit est un plus de traçabilité, pas une condition de fonctionnement | `min-DEV-01`, étape 8 |
| **Seeder mis à jour** (rôles automatiques) | Remplacé ici par une requête SQL d'une ligne | `DEV-01` complet, étape 4.3 |
| **Correctifs des tests existants** + **tests du module** (unitaires, intégration, e2e) | L'application fonctionne ; les tests sont la garantie long terme | `DEV-01` complet, étapes 3, 5, 6.7 et 12–14 |

**Le chemin conseillé pour la suite** : une fois ce guide digéré et la démo réussie, reprendre `min-DEV-01` pour ajouter les éléments différés, puis `DEV-01` complet pour les tests.

> 📌 Ce guide mini couvre désormais AUSSI la règle du « dernier ADMIN », l'interdiction de modifier son propre rôle, la réactivation et le changement de mot de passe : si tu enchaînes sur `min-DEV-01`, les passages correspondants (règles métier de l'étape 8) sont déjà en place ici — compare avant de copier-coller, il n'y a rien à refaire.

---

*Fin du guide mini-DEV-01. Tu viens de parcourir le trajet complet d'une fonctionnalité — domaine → port → migration → adapter → use case → DTO → contrôleur → module — c'est exactement le même pour les modules 02 à 10.*
