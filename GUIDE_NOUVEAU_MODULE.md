# Créer un nouveau module from scratch — Exemple : Articles

> Guide ultra-détaillé. Chaque ligne de code est commentée et expliquée.
> Le module `articles` est un exemple réaliste couvrant : table SQL, migration,
> domaine, infrastructure, cas d'utilisation, contrôleur REST, pagination,
> validation, Swagger et audit.

---

## Table des matières

1. [Ce qu'on va construire](#1-ce-quon-va-construire)
2. [Arborescence finale](#2-arborescence-finale)
3. [Étape 1 — La couche Domain](#étape-1--la-couche-domain)
   - [L'entité de domaine Article](#11-lentité-de-domaine-article)
   - [L'enum de statut](#12-lenum-de-statut)
   - [Le port du repository](#13-le-port-du-repository)
4. [Étape 2 — La couche Infrastructure](#étape-2--la-couche-infrastructure)
   - [L'entité TypeORM](#21-lentité-typeorm)
   - [La migration SQL](#22-la-migration-sql)
   - [Le mapper](#23-le-mapper)
   - [Le repository TypeORM](#24-le-repository-typeorm)
5. [Étape 3 — La couche Application](#étape-3--la-couche-application)
   - [Créer un article](#31-créer-un-article)
   - [Récupérer un article par ID](#32-récupérer-un-article-par-id)
   - [Lister les articles avec pagination](#33-lister-les-articles-avec-pagination)
   - [Mettre à jour un article](#34-mettre-à-jour-un-article)
   - [Supprimer un article](#35-supprimer-un-article)
6. [Étape 4 — La couche Presentation](#étape-4--la-couche-presentation)
   - [Les DTOs de requête](#41-les-dtos-de-requête)
   - [Les DTOs de réponse](#42-les-dtos-de-réponse)
   - [Le contrôleur](#43-le-contrôleur)
7. [Étape 5 — Le module NestJS](#étape-5--le-module-nestjs)
8. [Étape 6 — Enregistrement dans AppModule](#étape-6--enregistrement-dans-appmodule)
9. [Étape 7 — Lancer la migration](#étape-7--lancer-la-migration)
10. [Récapitulatif des fichiers créés](#10-récapitulatif-des-fichiers-créés)
11. [Schéma des dépendances](#11-schéma-des-dépendances)

---

## 1. Ce qu'on va construire

Un module `articles` avec :
- Une table `articles` en SQL Server
- Les opérations CRUD complètes via une API REST
- Pagination, tri, filtres sur la liste
- Validation stricte des entrées
- Audit des créations/suppressions
- Documentation Swagger complète

**Endpoints exposés :**

```
POST   /api/v1/articles          Créer un article
GET    /api/v1/articles          Lister avec pagination
GET    /api/v1/articles/:id      Récupérer par ID
PATCH  /api/v1/articles/:id      Mettre à jour
DELETE /api/v1/articles/:id      Supprimer (soft delete)
```

Un article possède les champs suivants :

| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `title` | string | Titre de l'article |
| `slug` | string | Identifiant URL unique |
| `content` | string (long) | Corps de l'article |
| `status` | enum | `draft` ou `published` |
| `authorId` | UUID | Référence vers l'utilisateur auteur |
| `publishedAt` | datetime2 / null | Date de publication |
| `createdAt` | datetime2 | Généré automatiquement |
| `updatedAt` | datetime2 | Mis à jour automatiquement |
| `deletedAt` | datetime2 / null | Soft delete |
| `createdBy` | UUID / null | Qui a créé |
| `updatedBy` | UUID / null | Qui a modifié |

---

## 2. Arborescence finale

```
src/modules/articles/
│
├── domain/
│   ├── article-status.enum.ts      ← Enum des statuts possibles
│   ├── article.ts                  ← Entité de domaine pure (pas de TypeORM)
│   └── article-repository.port.ts ← Interface du repository + Symbol d'injection
│
├── application/
│   ├── create-article.use-case.ts
│   ├── get-article-by-id.use-case.ts
│   ├── list-articles.use-case.ts
│   ├── update-article.use-case.ts
│   └── delete-article.use-case.ts
│
├── infrastructure/
│   ├── entities/
│   │   └── article.entity.ts       ← Entité TypeORM (mappée sur la table SQL)
│   ├── article.mapper.ts           ← Conversion TypeORM <-> Domaine
│   └── typeorm-article.repository.ts ← Implémentation concrète du port
│
├── presentation/
│   ├── dto/
│   │   ├── create-article.dto.ts
│   │   ├── update-article.dto.ts
│   │   ├── article-query.dto.ts    ← Paramètres de pagination/filtres
│   │   └── article-response.dto.ts
│   └── articles.controller.ts
│
└── articles.module.ts
```

---

## Étape 1 — La couche Domain

> **Règle d'or** : le domaine n'importe rien de NestJS, TypeORM, Express ou
> de n'importe quelle bibliothèque tierce. Ce sont des classes TypeScript pures.
> Un développeur qui n'a jamais utilisé NestJS doit pouvoir lire et comprendre
> ce code.

---

### 1.1 L'enum de statut

**Fichier** : `src/modules/articles/domain/article-status.enum.ts`

```typescript
/**
 * Statuts possibles d'un article.
 *
 * Pourquoi un enum plutôt qu'une simple chaîne "draft" | "published" ?
 *   - On limite les valeurs acceptables à la compilation (TypeScript).
 *   - On a un seul endroit à modifier si on ajoute un statut "archived".
 *   - Le validateur class-validator peut contrôler l'enum automatiquement.
 *   - TypeORM stocke la valeur sous forme de chaîne en base (nvarchar).
 */
export enum ArticleStatus {
  /** Article en cours de rédaction, non visible publiquement. */
  Draft = 'draft',

  /** Article publié et visible. publishedAt est alors renseigné. */
  Published = 'published',
}
```

---

### 1.2 L'entité de domaine Article

**Fichier** : `src/modules/articles/domain/article.ts`

```typescript
import { ArticleStatus } from './article-status.enum';

/**
 * Entité de domaine représentant un article.
 *
 * Cette classe est la "vérité métier" de l'application.
 * Elle ne sait pas comment elle est stockée en base (c'est le rôle
 * de ArticleEntity + ArticleMapper), ni comment elle voyage sur le
 * réseau (c'est le rôle des DTOs).
 *
 * On y place les règles métier : peut-on publier ? le slug est-il valide ?
 * C'est ici que la logique vit, pas dans le contrôleur.
 */
export class Article {
  constructor(
    /** Identifiant unique UUID — généré par SQL Server au INSERT. */
    public readonly id: string,

    /** Titre de l'article. */
    public readonly title: string,

    /**
     * Slug URL-friendly (ex. : "mon-premier-article").
     * Généré depuis le titre lors de la création, unique en base.
     */
    public readonly slug: string,

    /** Corps complet de l'article. Peut être en HTML ou Markdown. */
    public readonly content: string,

    /** Statut actuel : brouillon ou publié. */
    public readonly status: ArticleStatus,

    /**
     * UUID de l'auteur (référence vers la table users).
     * On stocke uniquement l'ID, pas l'objet User complet, pour éviter
     * un couplage fort entre le module articles et le module users.
     */
    public readonly authorId: string,

    /**
     * Date de publication, null tant que l'article est en brouillon.
     * Renseignée automatiquement lors du passage à PublishedStatus.
     */
    public readonly publishedAt: Date | null,

    /** Date de création — gérée automatiquement par TypeORM. */
    public readonly createdAt: Date,

    /** Date de dernière modification — mise à jour automatiquement. */
    public readonly updatedAt: Date,

    /**
     * Date de suppression logique (soft delete).
     * null = l'article existe ; une date = l'article est supprimé.
     * TypeORM exclut automatiquement les lignes soft-deletées des requêtes.
     */
    public readonly deletedAt: Date | null,
  ) {}

  /**
   * Vérifie si l'article peut être publié.
   *
   * Règles métier :
   *   - Un article déjà publié ne peut pas l'être à nouveau.
   *   - Un article sans contenu ne peut pas être publié.
   *
   * Cette méthode est testable sans base de données ni NestJS.
   * Le cas d'utilisation UpdateArticleUseCase l'appellera avant de persister.
   */
  canBePublished(): boolean {
    return this.status === ArticleStatus.Draft && this.content.trim().length > 0;
  }

  /**
   * Vérifie si l'article est actuellement visible (publié et non supprimé).
   */
  isVisible(): boolean {
    return this.status === ArticleStatus.Published && this.deletedAt === null;
  }
}

/**
 * Génère un slug URL-friendly depuis un titre.
 *
 * Pourquoi ici plutôt que dans le use case ?
 *   → C'est une règle de domaine : la transformation d'un titre en slug
 *     est une logique métier qui ne dépend d'aucun framework.
 *
 * Exemples :
 *   "Mon Article"  → "mon-article"
 *   "L'ÉTÉ 2026"  → "l-ete-2026"
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    // Normalise les caractères accentués (é → e, à → a, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remplace tout ce qui n'est pas alphanumérique par un tiret
    .replace(/[^a-z0-9]+/g, '-')
    // Supprime les tirets en début et fin
    .replace(/^-+|-+$/g, '');
}
```

---

### 1.3 Le port du repository

**Fichier** : `src/modules/articles/domain/article-repository.port.ts`

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Article } from './article';
import { ArticleStatus } from './article-status.enum';

/**
 * Paramètres de liste des articles.
 *
 * Le domaine définit CE DONT il a besoin (les critères de recherche),
 * sans savoir comment c'est implémenté en SQL.
 */
export interface ListArticlesParams {
  /** Numéro de page, commence à 1. */
  page: number;

  /** Nombre d'éléments par page. */
  limit: number;

  /** Colonne de tri (valeur logique, pas un nom SQL brut). */
  sortBy?: string;

  /** Direction du tri. */
  sortDirection: SortDirection;

  /** Recherche textuelle dans le titre et le contenu. */
  search?: string;

  /** Filtre optionnel par statut. */
  status?: ArticleStatus;

  /** Filtre optionnel par auteur. */
  authorId?: string;
}

/**
 * Paramètres de création d'un article.
 *
 * Le domaine décrit ce qu'il faut pour créer une entité, sans
 * mentionner ni Express ni NestJS.
 */
export interface CreateArticleParams {
  title: string;
  slug: string;
  content: string;
  status: ArticleStatus;
  authorId: string;
  publishedAt: Date | null;
  /** UUID de l'auteur pour la traçabilité (createdBy). */
  createdBy: string | null;
}

/**
 * Paramètres de mise à jour partielle d'un article.
 *
 * Tous les champs sont optionnels : seuls ceux fournis sont mis à jour.
 * C'est le pattern "Partial Update" (équivalent d'un PATCH HTTP).
 */
export interface UpdateArticleParams {
  title?: string;
  slug?: string;
  content?: string;
  status?: ArticleStatus;
  publishedAt?: Date | null;
  /** UUID de celui qui effectue la modification, pour updatedBy. */
  updatedBy: string | null;
}

/**
 * Contrat de persistance des articles.
 *
 * C'est une INTERFACE, pas une implémentation. Le domaine dit
 * "j'ai besoin de ces opérations", mais ne sait pas si c'est
 * TypeORM, MongoDB, une API externe ou un mock de test qui répond.
 *
 * Ce découplage permet de :
 *   1. Tester les use cases sans base de données (avec un mock).
 *   2. Changer d'ORM ou de base de données sans toucher au domaine.
 */
export interface ArticleRepositoryPort {
  /**
   * Crée un article et retourne l'entité persistée (avec l'ID généré).
   */
  create(params: CreateArticleParams): Promise<Article>;

  /**
   * Recherche un article par son UUID.
   * Retourne null si inexistant ou soft-deleted.
   */
  findById(id: string): Promise<Article | null>;

  /**
   * Recherche un article par son slug.
   * Retourne null si inexistant ou soft-deleted.
   */
  findBySlug(slug: string): Promise<Article | null>;

  /**
   * Retourne une liste paginée d'articles selon les critères.
   */
  list(params: ListArticlesParams): Promise<PaginatedResult<Article>>;

  /**
   * Met à jour les champs fournis d'un article existant.
   * Retourne l'article mis à jour.
   */
  update(id: string, params: UpdateArticleParams): Promise<Article>;

  /**
   * Suppression logique (soft delete) : remplit deleted_at.
   * L'article ne sera plus retourné par les requêtes standard.
   */
  softDelete(id: string): Promise<void>;

  /**
   * Vérifie si un slug est déjà utilisé par un autre article.
   * Utilisé lors de la création ou la mise à jour du titre.
   *
   * `excludeId` : UUID d'un article à exclure de la vérification
   * (lors d'une mise à jour, on veut pouvoir garder son propre slug).
   */
  isSlugTaken(slug: string, excludeId?: string): Promise<boolean>;
}

/**
 * Symbol d'injection NestJS.
 *
 * Pourquoi un Symbol plutôt qu'une chaîne ?
 *   → Un Symbol est unique par définition, il ne peut pas entrer en
 *     collision avec un autre token, même s'il a le même nom dans un
 *     autre fichier.
 *
 * Ce Symbol est utilisé de deux façons :
 *   1. Dans le module NestJS : { provide: ARTICLE_REPOSITORY, useClass: TypeOrmArticleRepository }
 *   2. Dans les use cases : @Inject(ARTICLE_REPOSITORY)
 */
export const ARTICLE_REPOSITORY = Symbol('ARTICLE_REPOSITORY');
```

---

## Étape 2 — La couche Infrastructure

> L'infrastructure implémente les contrats définis par le domaine.
> C'est la seule couche qui connaît TypeORM, SQL Server, et les détails
> de stockage. Elle traduit les entités TypeORM en objets de domaine via le mapper.

---

### 2.1 L'entité TypeORM

**Fichier** : `src/modules/articles/infrastructure/entities/article.entity.ts`

```typescript
import { Column, Entity, Index } from 'typeorm';
// AuditableEntity fournit : id (UUID PK), createdAt, updatedAt, deletedAt, createdBy, updatedBy
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { ArticleStatus } from '../../domain/article-status.enum';

/**
 * Entité TypeORM mappée sur la table `articles`.
 *
 * Cette classe NE contient PAS de règles métier : elle décrit uniquement
 * la structure de la table SQL. La logique métier vit dans Article (domaine).
 *
 * @Entity({ name: 'articles' })
 *   → Indique à TypeORM que cette classe correspond à la table "articles".
 *   → Sans ce décorateur, TypeORM l'ignore complètement.
 *
 * extends AuditableEntity
 *   → Hérite des colonnes communes : id, createdAt, updatedAt, deletedAt,
 *     createdBy, updatedBy. On n'a pas à les redéclarer ici.
 */
@Entity({ name: 'articles' })
export class ArticleEntity extends AuditableEntity {
  /**
   * @Column({ ... })
   *   → Mappe cette propriété TypeScript sur une colonne SQL.
   *
   * name: 'title'
   *   → Nom réel de la colonne en base. Par convention, snake_case en SQL
   *     et camelCase en TypeScript.
   *
   * type: 'nvarchar'
   *   → Type SQL Server pour les chaînes Unicode (supporte les accents,
   *     les émojis, etc.). Toujours préférer nvarchar à varchar en SQL Server
   *     pour les données utilisateur.
   *
   * length: 500
   *   → Longueur maximale. SQL Server impose une limite pour nvarchar.
   *     nvarchar(max) n'est pas indexable, donc on fixe une longueur.
   */
  @Column({ name: 'title', type: 'nvarchar', length: 500 })
  title!: string;

  /**
   * @Index('UQ_articles_slug', { unique: true })
   *   → Crée un index UNIQUE sur cette colonne.
   *   → Le nom 'UQ_articles_slug' est le nom SQL de la contrainte.
   *     Convention du projet : UQ_<table>_<colonne>.
   *   → TypeORM refuse l'insertion si le slug existe déjà (erreur SQL 2627).
   *     Le GlobalExceptionFilter convertit cette erreur en RESOURCE_ALREADY_EXISTS.
   */
  @Index('UQ_articles_slug', { unique: true })
  @Column({ name: 'slug', type: 'nvarchar', length: 600 })
  slug!: string;

  /**
   * nvarchar(max) pour le contenu long.
   *
   * Attention : nvarchar(max) ne peut pas être indexé directement.
   * Pour une recherche full-text, SQL Server propose des index full-text
   * spécialisés — hors scope de ce guide.
   */
  @Column({ name: 'content', type: 'nvarchar', length: 'max' })
  content!: string;

  /**
   * Statut stocké comme chaîne via l'enum.
   * TypeORM stocke la valeur de l'enum ('draft', 'published'), pas son label.
   *
   * default: ArticleStatus.Draft
   *   → Valeur par défaut au niveau SQL Server. Si on insère sans ce champ,
   *     SQL Server met 'draft' automatiquement.
   */
  @Column({
    name: 'status',
    type: 'nvarchar',
    length: 20,
    default: ArticleStatus.Draft,
  })
  status!: ArticleStatus;

  /**
   * type: 'uniqueidentifier'
   *   → Type SQL Server pour les UUID. On ne crée pas de relation TypeORM
   *     vers UserEntity ici car le module articles ne doit pas dépendre du
   *     module users (évite un couplage cyclique). On stocke juste l'UUID.
   */
  @Column({ name: 'author_id', type: 'uniqueidentifier' })
  authorId!: string;

  /**
   * nullable: true
   *   → La colonne accepte NULL. Un brouillon n'a pas de date de publication.
   *
   * type: 'datetime2'
   *   → Type SQL Server pour les dates avec haute précision et support UTC.
   *     Toujours préférer datetime2 à datetime en SQL Server moderne.
   */
  @Column({ name: 'published_at', type: 'datetime2', nullable: true })
  publishedAt!: Date | null;
}
```

---

### 2.2 La migration SQL

**Commande à exécuter pour générer automatiquement la migration :**

```bash
npm run migration:generate -- --name CreateArticlesTable
```

> Cette commande compare l'état actuel de la base avec les entités TypeORM
> et génère le SQL de différence. Elle crée un fichier dans
> `src/database/migrations/`. **Important** : l'entité doit d'abord être
> enregistrée dans le module (étape 5) pour que TypeORM la détecte.

Si vous voulez l'écrire manuellement, voici à quoi elle ressemble :

**Fichier** : `src/database/migrations/<timestamp>-CreateArticlesTable.ts`

```typescript
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration de création de la table articles.
 *
 * MigrationInterface impose deux méthodes :
 *   - up()   : applique la migration (crée la table)
 *   - down() : annule la migration (supprime la table)
 *
 * La méthode down() est cruciale : elle permet de revenir en arrière
 * avec `npm run migration:revert` si quelque chose se passe mal.
 */
export class CreateArticlesTable<timestamp> implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * queryRunner.createTable() génère et exécute le CREATE TABLE.
     *
     * new Table({ ... }) décrit la structure de la table.
     *
     * columns: []
     *   → Liste des colonnes. Chaque objet décrit une colonne SQL.
     */
    await queryRunner.createTable(
      new Table({
        name: 'articles',
        columns: [
          {
            /**
             * Clé primaire UUID.
             *
             * type: 'uniqueidentifier'
             *   → Type SQL Server natif pour les UUID (GUID).
             *
             * isPrimary: true
             *   → Déclare cette colonne comme clé primaire.
             *
             * default: 'NEWID()'
             *   → SQL Server génère automatiquement un UUID à l'INSERT.
             *     NEWID() est la fonction SQL Server pour ça. En PostgreSQL,
             *     ce serait gen_random_uuid().
             */
            name: 'id',
            type: 'uniqueidentifier',
            isPrimary: true,
            default: 'NEWID()',
          },
          {
            /**
             * Dates de traçabilité — gérées par TypeORM via
             * @CreateDateColumn et @UpdateDateColumn.
             *
             * default: 'GETUTCDATE()'
             *   → SQL Server insère automatiquement la date UTC courante.
             */
            name: 'created_at',
            type: 'datetime2',
            default: 'GETUTCDATE()',
          },
          {
            name: 'updated_at',
            type: 'datetime2',
            default: 'GETUTCDATE()',
          },
          {
            /**
             * Colonne de soft delete.
             *
             * isNullable: true
             *   → NULL = l'enregistrement existe et est actif.
             *     Une date = il a été "supprimé" logiquement.
             *
             * TypeORM avec @DeleteDateColumn ajoute automatiquement
             * WHERE deleted_at IS NULL à toutes les requêtes standard.
             */
            name: 'deleted_at',
            type: 'datetime2',
            isNullable: true,
          },
          {
            /**
             * Traçabilité créateur/modificateur.
             * On stocke l'UUID de l'utilisateur, pas une FK TypeORM,
             * pour éviter la dépendance cyclique entre modules.
             */
            name: 'created_by',
            type: 'uniqueidentifier',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uniqueidentifier',
            isNullable: true,
          },
          {
            name: 'title',
            type: 'nvarchar',
            length: '500',
          },
          {
            /**
             * Slug avec contrainte UNIQUE.
             * L'index unique est déclaré séparément via indices: [].
             */
            name: 'slug',
            type: 'nvarchar',
            length: '600',
          },
          {
            /**
             * nvarchar(max) = texte de longueur illimitée en SQL Server.
             * Équivalent de TEXT en PostgreSQL.
             */
            name: 'content',
            type: 'nvarchar',
            length: 'max',
          },
          {
            name: 'status',
            type: 'nvarchar',
            length: '20',
            default: "'draft'",
            // Les valeurs par défaut de type chaîne nécessitent
            // des guillemets simples DANS les guillemets du JSON.
          },
          {
            name: 'author_id',
            type: 'uniqueidentifier',
          },
          {
            name: 'published_at',
            type: 'datetime2',
            isNullable: true,
          },
        ],
        /**
         * indices: []
         *   → Index supplémentaires (non-PK).
         *     L'index unique sur slug est déclaré ici.
         */
        indices: [
          new TableIndex({
            name: 'UQ_articles_slug',
            columnNames: ['slug'],
            isUnique: true,
          }),
          // Index sur author_id pour accélérer les requêtes
          // "tous les articles d'un auteur"
          new TableIndex({
            name: 'IDX_articles_author_id',
            columnNames: ['author_id'],
          }),
          // Index sur status pour filtrer rapidement par statut
          new TableIndex({
            name: 'IDX_articles_status',
            columnNames: ['status'],
          }),
        ],
      }),
      // true = ignorer l'erreur si la table existe déjà (idempotence)
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /**
     * On supprime la table dans l'ordre inverse de la création.
     * dropTable() supprime aussi les index et contraintes associés.
     */
    await queryRunner.dropTable('articles', true);
  }
}
```

---

### 2.3 Le mapper

**Fichier** : `src/modules/articles/infrastructure/article.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Article } from '../domain/article';
import { ArticleEntity } from './entities/article.entity';

/**
 * Convertit les entités TypeORM en objets de domaine et vice-versa.
 *
 * @Injectable()
 *   → NestJS peut l'injecter dans le repository. On le déclare comme
 *     provider dans le module.
 *
 * Pourquoi ne pas utiliser directement ArticleEntity partout ?
 *   → L'entité TypeORM est liée à la base. Si on change le nom d'une
 *     colonne, on ne veut pas avoir à modifier les use cases.
 *   → Les objets de domaine peuvent avoir des méthodes (canBePublished)
 *     que les entités TypeORM n'ont pas.
 *   → En test unitaire, on peut créer un Article sans passer par TypeORM.
 */
@Injectable()
export class ArticleMapper {
  /**
   * Convertit une ArticleEntity (TypeORM, vient de la base) en Article (domaine).
   *
   * Cette conversion est appelée APRÈS chaque lecture en base.
   * Le repository ne retourne jamais une ArticleEntity vers les use cases.
   */
  toDomain(entity: ArticleEntity): Article {
    return new Article(
      entity.id,
      entity.title,
      entity.slug,
      entity.content,
      entity.status,
      entity.authorId,
      entity.publishedAt,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
```

---

### 2.4 Le repository TypeORM

**Fichier** : `src/modules/articles/infrastructure/typeorm-article.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Not, Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { TypeOrmFilterHelper } from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import {
  ArticleRepositoryPort,
  CreateArticleParams,
  ListArticlesParams,
  UpdateArticleParams,
} from '../domain/article-repository.port';
import { Article } from '../domain/article';
import { ArticleEntity } from './entities/article.entity';
import { ArticleMapper } from './article.mapper';

/**
 * Liste blanche des colonnes triables côté articles.
 *
 * Clé   : nom LOGIQUE exposé par l'API (ce que le client envoie dans sortBy)
 * Valeur : expression TypeORM (alias de la requête + nom de la propriété)
 *
 * SÉCURITÉ : le nom de colonne SQL ne vient JAMAIS directement du client.
 *   Un client qui envoie sortBy="; DROP TABLE articles" se heurtera à
 *   "tri non autorisé" car cette valeur n'est pas dans la whitelist.
 */
export const ARTICLE_SORTABLE_COLUMNS = {
  title: 'article.title',
  createdAt: 'article.createdAt',
  updatedAt: 'article.updatedAt',
  publishedAt: 'article.publishedAt',
  status: 'article.status',
} as const;

/**
 * Implémentation TypeORM du repository articles.
 *
 * implements ArticleRepositoryPort
 *   → TypeScript vérifie que toutes les méthodes de l'interface sont
 *     implémentées. Si on oublie findBySlug(), erreur de compilation.
 */
@Injectable()
export class TypeOrmArticleRepository implements ArticleRepositoryPort {
  constructor(
    /**
     * @InjectRepository(ArticleEntity)
     *   → NestJS injecte le Repository<ArticleEntity> fourni par TypeORM.
     *   → Ce repository est lié à la connexion SQL Server configurée dans
     *     DatabaseModule. Il fournit find, findOne, save, update, etc.
     *   → Pour que cette injection fonctionne, ArticleEntity DOIT être
     *     déclarée dans TypeOrmModule.forFeature([ArticleEntity]) du module.
     */
    @InjectRepository(ArticleEntity)
    private readonly repository: Repository<ArticleEntity>,

    /** Le mapper est injecté pour convertir les entités en objets de domaine. */
    private readonly mapper: ArticleMapper,
  ) {}

  /**
   * Crée un article et retourne l'entité persistée avec l'UUID généré.
   *
   * this.repository.create({ ... })
   *   → Crée une instance de ArticleEntity en mémoire (pas encore en base).
   *     C'est juste un constructeur intelligent qui applique les valeurs par défaut.
   *
   * this.repository.save(entity)
   *   → Exécute le INSERT SQL et retourne l'entité avec l'id généré par SQL Server.
   *     Si l'entité avait déjà un id, TypeORM ferait un UPDATE.
   */
  async create(params: CreateArticleParams): Promise<Article> {
    const entity = this.repository.create({
      title: params.title,
      slug: params.slug,
      content: params.content,
      status: params.status,
      authorId: params.authorId,
      publishedAt: params.publishedAt,
      createdBy: params.createdBy,
      updatedBy: params.createdBy, // Au moment de la création, le créateur = modificateur
    });

    const saved = await this.repository.save(entity);

    // On convertit IMMÉDIATEMENT l'entité TypeORM en objet de domaine.
    // Le use case ne verra jamais un ArticleEntity.
    return this.mapper.toDomain(saved);
  }

  /**
   * Recherche par UUID. TypeORM exclut automatiquement les soft-deleted
   * grâce au @DeleteDateColumn sur AuditableEntity.
   */
  async findById(id: string): Promise<Article | null> {
    const entity = await this.repository.findOne({ where: { id } });
    // Si null : l'article n'existe pas ou est soft-deleted
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findBySlug(slug: string): Promise<Article | null> {
    const entity = await this.repository.findOne({ where: { slug } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  /**
   * Liste paginée avec tri, filtres et recherche textuelle.
   *
   * On utilise QueryBuilder plutôt que find() pour plus de flexibilité.
   * TypeOrmFilterHelper et TypeOrmPaginationHelper gèrent respectivement
   * le tri (avec whitelist) et la pagination (skip/take).
   *
   * createQueryBuilder('article')
   *   → 'article' est l'ALIAS de la table dans la requête SQL générée.
   *     On l'utilise pour préfixer les colonnes : 'article.title', etc.
   */
  async list(params: ListArticlesParams): Promise<PaginatedResult<Article>> {
    const qb = this.repository.createQueryBuilder('article');

    // Recherche textuelle : cherche dans le titre ET le contenu.
    // ILike = LIKE insensible à la casse (SQL Server : LIKE avec COLLATE).
    // Le % avant et après cherche la chaîne n'importe où dans la valeur.
    if (params.search) {
      qb.andWhere(
        '(article.title LIKE :search OR article.content LIKE :search)',
        // Le paramètre nommé :search évite l'injection SQL.
        // TypeORM encode la valeur avant de l'insérer dans la requête.
        { search: `%${params.search}%` },
      );
    }

    // Filtre par statut si fourni
    if (params.status) {
      qb.andWhere('article.status = :status', { status: params.status });
    }

    // Filtre par auteur si fourni
    if (params.authorId) {
      qb.andWhere('article.authorId = :authorId', { authorId: params.authorId });
    }

    // Applique le tri via la whitelist.
    // Si sortBy est absent ou invalide, lance une erreur 400.
    TypeOrmFilterHelper.applySort(
      qb,
      params.sortBy,
      params.sortDirection,
      ARTICLE_SORTABLE_COLUMNS,
    );

    // Applique skip/take et retourne { items, meta } avec totalPages calculé.
    const result = await TypeOrmPaginationHelper.paginate(
      qb,
      params.page,
      params.limit,
    );

    // Convertit chaque ArticleEntity en Article (domaine)
    return {
      items: result.items.map((entity) => this.mapper.toDomain(entity)),
      meta: result.meta,
    };
  }

  /**
   * Mise à jour partielle (PATCH).
   *
   * On construit un objet avec uniquement les champs fournis (ceux qui ne
   * sont pas undefined). TypeORM génère un UPDATE ne ciblant que ces colonnes.
   *
   * Exemple : si on ne fournit que { title: 'Nouveau titre', updatedBy: 'uuid' },
   * le SQL sera : UPDATE articles SET title=..., updated_by=... WHERE id=...
   * Le content, slug, status ne sont pas touchés.
   */
  async update(id: string, params: UpdateArticleParams): Promise<Article> {
    // On construit un objet partiel avec seulement les valeurs définies.
    // L'opérateur spread avec undefined filtre automatiquement les champs absents.
    const updateData: Partial<ArticleEntity> = {
      updatedBy: params.updatedBy ?? null,
    };

    if (params.title !== undefined) updateData.title = params.title;
    if (params.slug !== undefined) updateData.slug = params.slug;
    if (params.content !== undefined) updateData.content = params.content;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.publishedAt !== undefined) updateData.publishedAt = params.publishedAt;

    // repository.update() génère un UPDATE SQL ciblant uniquement les champs fournis.
    // Le premier argument est la condition WHERE.
    await this.repository.update({ id }, updateData);

    // On recharge l'entité depuis la base pour avoir les valeurs à jour
    // (notamment updated_at que SQL Server a mis à jour automatiquement).
    const updated = await this.repository.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(updated);
  }

  /**
   * Soft delete : remplit deleted_at avec la date courante.
   *
   * repository.softDelete() est la méthode TypeORM pour le soft delete.
   * Elle met updated_at et deleted_at à GETUTCDATE() automatiquement.
   * L'enregistrement reste en base mais n'apparaît plus dans les requêtes standard.
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id });
  }

  /**
   * Vérifie si un slug est déjà utilisé.
   *
   * excludeId : lors d'une mise à jour de titre, l'article peut garder
   * son propre slug sans déclencher l'erreur "déjà pris".
   */
  async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        slug,
        // Si excludeId est fourni, on exclut cet article de la vérification.
        // Not(excludeId) génère WHERE id != 'excludeId' en SQL.
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    return count > 0;
  }
}
```

---

## Étape 3 — La couche Application

> Les use cases orchestrent la logique. Ils utilisent les ports du domaine
> (jamais TypeORM directement) et coordonnent les opérations.
> Chaque use case a une responsabilité unique (principe SRP).

---

### 3.1 Créer un article

**Fichier** : `src/modules/articles/application/create-article.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceAlreadyExistsException } from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { ArticleStatus } from '../domain/article-status.enum';
import { Article, generateSlug } from '../domain/article';
import {
  ARTICLE_REPOSITORY,
  ArticleRepositoryPort,
} from '../domain/article-repository.port';

/** Ce que le contrôleur passe au use case. */
export interface CreateArticleInput {
  title: string;
  content: string;
  /** Optionnel : si absent, le slug est généré depuis le titre. */
  slug?: string;
  /** UUID de l'utilisateur connecté (fourni par le contrôleur). */
  authorId: string;
}

/** Ce que le use case retourne. */
export interface CreateArticleOutput {
  article: Article;
}

/**
 * Cas d'utilisation : créer un article.
 *
 * Responsabilités :
 *   1. Générer le slug si absent.
 *   2. Vérifier que le slug n'est pas déjà utilisé.
 *   3. Persister l'article.
 *   4. Enregistrer un événement d'audit.
 */
@Injectable()
export class CreateArticleUseCase {
  constructor(
    /**
     * @Inject(ARTICLE_REPOSITORY)
     *   → Injecte l'implémentation liée au Symbol ARTICLE_REPOSITORY.
     *   → NestJS résout ce Symbol grâce à la déclaration dans articles.module.ts :
     *     { provide: ARTICLE_REPOSITORY, useClass: TypeOrmArticleRepository }
     *
     * private readonly articleRepository: ArticleRepositoryPort
     *   → Le TYPE est l'interface (domaine), pas la classe concrète (infra).
     *     Ce use case ne sait pas si c'est TypeORM, MongoDB ou un mock.
     */
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepositoryPort,

    /** Injecté normalement (par classe), pas besoin de Symbol. */
    private readonly auditService: AuditService,
  ) {}

  async execute(input: CreateArticleInput): Promise<CreateArticleOutput> {
    // Étape 1 : générer le slug depuis le titre si non fourni.
    // generateSlug est une fonction pure du domaine (pas de dépendance externe).
    const slug = input.slug ?? generateSlug(input.title);

    // Étape 2 : vérifier l'unicité du slug.
    // On vérifie AVANT de tenter l'INSERT pour avoir un message d'erreur clair.
    // Sans cette vérification, l'INSERT planterait avec une erreur SQL 2627
    // (violation de contrainte unique), que le GlobalExceptionFilter convertirait
    // en RESOURCE_ALREADY_EXISTS — mais avec un message moins précis.
    const slugTaken = await this.articleRepository.isSlugTaken(slug);
    if (slugTaken) {
      throw new ResourceAlreadyExistsException(
        `Le slug "${slug}" est déjà utilisé par un autre article.`,
      );
    }

    // Étape 3 : persister l'article.
    // On crée un brouillon par défaut.
    const article = await this.articleRepository.create({
      title: input.title,
      slug,
      content: input.content,
      // Par défaut, un nouvel article est en brouillon.
      status: ArticleStatus.Draft,
      authorId: input.authorId,
      publishedAt: null,
      createdBy: input.authorId,
    });

    // Étape 4 : audit.
    // On ne lève pas d'erreur si l'audit échoue (résilience).
    // L'AuditService gère ça en interne.
    await this.auditService.record({
      category: AuditCategory.Business,
      action: 'article.created',
      actorUserId: input.authorId,
      resourceType: 'article',
      resourceId: article.id,
      metadata: { title: article.title, slug: article.slug },
    });

    return { article };
  }
}
```

---

### 3.2 Récupérer un article par ID

**Fichier** : `src/modules/articles/application/get-article-by-id.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Article } from '../domain/article';
import {
  ARTICLE_REPOSITORY,
  ArticleRepositoryPort,
} from '../domain/article-repository.port';

@Injectable()
export class GetArticleByIdUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepositoryPort,
  ) {}

  /**
   * Retourne l'article ou lève ResourceNotFoundException.
   *
   * On ne retourne jamais null depuis un use case "get by id" :
   * si l'article n'existe pas, c'est une erreur métier, pas un cas normal.
   * Le contrôleur reçoit une exception et laisse le filtre global la gérer.
   */
  async execute(id: string): Promise<Article> {
    const article = await this.articleRepository.findById(id);

    if (!article) {
      // ResourceNotFoundException génère une réponse 404 avec le code
      // RESOURCE_NOT_FOUND et un message en français.
      throw new ResourceNotFoundException("L'article");
    }

    return article;
  }
}
```

---

### 3.3 Lister les articles avec pagination

**Fichier** : `src/modules/articles/application/list-articles.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Article } from '../domain/article';
import { ArticleStatus } from '../domain/article-status.enum';
import {
  ARTICLE_REPOSITORY,
  ArticleRepositoryPort,
} from '../domain/article-repository.port';

/** Paramètres que le contrôleur passe au use case. */
export interface ListArticlesInput {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  search?: string;
  status?: ArticleStatus;
  authorId?: string;
}

@Injectable()
export class ListArticlesUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepositoryPort,
  ) {}

  /**
   * Retourne un PaginatedResult<Article>.
   *
   * L'interceptor ResponseEnvelopeInterceptor détecte automatiquement
   * les PaginatedResult et les place dans :
   * { data: items[], meta: { pagination: { page, limit, totalItems, ... } } }
   */
  async execute(input: ListArticlesInput): Promise<PaginatedResult<Article>> {
    return this.articleRepository.list({
      page: input.page,
      limit: input.limit,
      sortBy: input.sortBy,
      sortDirection: input.sortDirection,
      search: input.search,
      status: input.status,
      authorId: input.authorId,
    });
  }
}
```

---

### 3.4 Mettre à jour un article

**Fichier** : `src/modules/articles/application/update-article.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { Article, generateSlug } from '../domain/article';
import { ArticleStatus } from '../domain/article-status.enum';
import {
  ARTICLE_REPOSITORY,
  ArticleRepositoryPort,
} from '../domain/article-repository.port';

export interface UpdateArticleInput {
  id: string;
  title?: string;
  content?: string;
  status?: ArticleStatus;
  /** UUID de l'utilisateur connecté effectuant la modification. */
  updatedBy: string;
}

@Injectable()
export class UpdateArticleUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepositoryPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(input: UpdateArticleInput): Promise<Article> {
    // Étape 1 : vérifier que l'article existe.
    const existing = await this.articleRepository.findById(input.id);
    if (!existing) {
      throw new ResourceNotFoundException("L'article");
    }

    // Étape 2 : si le titre change, régénérer le slug et vérifier son unicité.
    let newSlug: string | undefined;
    if (input.title && input.title !== existing.title) {
      newSlug = generateSlug(input.title);
      // On exclut l'article courant de la vérification (il peut garder son slug).
      const slugTaken = await this.articleRepository.isSlugTaken(newSlug, input.id);
      if (slugTaken) {
        throw new ResourceAlreadyExistsException(
          `Le slug "${newSlug}" est déjà utilisé.`,
        );
      }
    }

    // Étape 3 : appliquer la règle métier de publication.
    // La méthode canBePublished() vit dans l'entité de domaine Article.
    let publishedAt: Date | null | undefined;
    if (input.status === ArticleStatus.Published) {
      // On utilise le contenu mis à jour (si fourni) ou l'existant pour la vérification.
      const contentToCheck = input.content ?? existing.content;
      const articleToCheck = { ...existing, content: contentToCheck } as Article;

      if (!articleToCheck.canBePublished()) {
        throw new Error(
          "Impossible de publier : l'article est déjà publié ou son contenu est vide.",
        );
      }
      // On fixe la date de publication au moment exact de la publication.
      publishedAt = new Date();
    }

    // Étape 4 : persister les modifications.
    const updated = await this.articleRepository.update(input.id, {
      title: input.title,
      slug: newSlug,
      content: input.content,
      status: input.status,
      publishedAt,
      updatedBy: input.updatedBy,
    });

    // Étape 5 : audit.
    await this.auditService.record({
      category: AuditCategory.Business,
      action: 'article.updated',
      actorUserId: input.updatedBy,
      resourceType: 'article',
      resourceId: input.id,
    });

    return updated;
  }
}
```

---

### 3.5 Supprimer un article

**Fichier** : `src/modules/articles/application/delete-article.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import {
  ARTICLE_REPOSITORY,
  ArticleRepositoryPort,
} from '../domain/article-repository.port';

@Injectable()
export class DeleteArticleUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepositoryPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(id: string, deletedBy: string): Promise<void> {
    // On vérifie que l'article existe avant de tenter la suppression.
    const existing = await this.articleRepository.findById(id);
    if (!existing) {
      throw new ResourceNotFoundException("L'article");
    }

    // Soft delete : met deleted_at = NOW() en base.
    // L'article reste dans la base mais n'apparaît plus dans les requêtes.
    await this.articleRepository.softDelete(id);

    await this.auditService.record({
      category: AuditCategory.Business,
      action: 'article.deleted',
      actorUserId: deletedBy,
      resourceType: 'article',
      resourceId: id,
      metadata: { title: existing.title },
    });
  }
}
```

---

## Étape 4 — La couche Presentation

> La couche presentation s'occupe exclusivement du protocole HTTP :
> désérialiser la requête, valider les entrées, appeler le use case,
> sérialiser la réponse. AUCUNE logique métier ici.

---

### 4.1 Les DTOs de requête

**Fichier** : `src/modules/articles/presentation/dto/create-article.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO (Data Transfer Object) de création d'article.
 *
 * Un DTO est une classe dont le seul rôle est de décrire la forme
 * d'une requête HTTP entrante. Il est différent de l'entité de domaine :
 *   - Il contient les décorateurs de validation (class-validator).
 *   - Il contient les décorateurs Swagger (@ApiProperty).
 *   - Il n'a aucune méthode métier.
 *
 * Le ValidationPipe global lit ces décorateurs et valide automatiquement
 * le corps de la requête AVANT que le contrôleur soit appelé.
 */
export class CreateArticleDto {
  /**
   * @ApiProperty()
   *   → Informe Swagger de l'existence de ce champ.
   *     Sans ce décorateur, Swagger ne le documente pas.
   *
   * description
   *   → Texte affiché dans la doc Swagger.
   *
   * example
   *   → Valeur d'exemple dans la doc Swagger.
   */
  @ApiProperty({
    description: "Titre de l'article.",
    example: 'Introduction à NestJS',
    maxLength: 500,
  })
  /**
   * @IsNotEmpty()
   *   → Refuse les chaînes vides ("") et les valeurs null/undefined.
   *
   * @IsString()
   *   → Vérifie que la valeur est bien une chaîne.
   *
   * @MaxLength(500)
   *   → Limite la longueur. Cohérent avec la colonne SQL (nvarchar(500)).
   *
   * Si l'une de ces contraintes échoue, le ValidationPipe renvoie
   * automatiquement une réponse 400 avec le code VALIDATION_ERROR
   * et la liste des champs invalides.
   */
  @IsNotEmpty({ message: 'Le titre est obligatoire.' })
  @IsString()
  @MaxLength(500, { message: 'Le titre ne peut pas dépasser 500 caractères.' })
  title!: string;

  @ApiProperty({
    description: "Contenu de l'article.",
    example: 'NestJS est un framework Node.js...',
  })
  @IsNotEmpty({ message: 'Le contenu est obligatoire.' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description:
      "Slug URL personnalisé. Généré automatiquement depuis le titre si absent.",
    example: 'introduction-a-nestjs',
    maxLength: 600,
  })
  /**
   * @IsOptional()
   *   → Ce champ peut être absent de la requête. Sans ce décorateur,
   *     class-validator le considérerait comme obligatoire.
   */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  slug?: string;
}
```

**Fichier** : `src/modules/articles/presentation/dto/update-article.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ArticleStatus } from '../../domain/article-status.enum';

/**
 * DTO de mise à jour partielle (PATCH).
 *
 * Tous les champs sont optionnels : le client n'envoie que ce qu'il veut modifier.
 * C'est la sémantique HTTP PATCH (vs PUT qui remplace tout).
 */
export class UpdateArticleDto {
  @ApiPropertyOptional({ description: "Nouveau titre.", maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ description: "Nouveau contenu." })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: "Nouveau statut.",
    enum: ArticleStatus,
  })
  /**
   * @IsEnum(ArticleStatus)
   *   → Vérifie que la valeur est bien 'draft' ou 'published'.
   *     Refuse toute autre chaîne.
   */
  @IsOptional()
  @IsEnum(ArticleStatus, {
    message: `Le statut doit être l'une des valeurs suivantes : ${Object.values(ArticleStatus).join(', ')}.`,
  })
  status?: ArticleStatus;
}
```

**Fichier** : `src/modules/articles/presentation/dto/article-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
// On ÉTEND PaginationQueryDto pour hériter de page, limit, sortBy,
// sortDirection, search. On n'a qu'à ajouter les filtres spécifiques aux articles.
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { ArticleStatus } from '../../domain/article-status.enum';

/**
 * Paramètres de requête pour la liste des articles.
 *
 * extends PaginationQueryDto
 *   → Hérite de page, limit, sortBy, sortDirection, search.
 *     Le client peut utiliser ?page=2&limit=10&sortBy=createdAt&search=nestjs
 *     sans qu'on ait à redéclarer ces champs.
 *
 * On ajoute ici les filtres propres aux articles.
 */
export class ArticleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrer par statut.',
    enum: ArticleStatus,
  })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;

  @ApiPropertyOptional({
    description: "Filtrer par UUID d'auteur.",
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: "L'identifiant d'auteur doit être un UUID valide." })
  authorId?: string;
}
```

---

### 4.2 Les DTOs de réponse

**Fichier** : `src/modules/articles/presentation/dto/article-response.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Article } from '../../domain/article';
import { ArticleStatus } from '../../domain/article-status.enum';

/**
 * DTO de réponse pour un article.
 *
 * Ce DTO contrôle ce que l'API expose au client.
 * On n'expose jamais l'entité de domaine ou TypeORM directement :
 *   - On choisit exactement quels champs exposer.
 *   - On peut renommer des champs (camelCase → camelCase, ou autre convention).
 *   - On peut transformer des valeurs (dates en ISO string, etc.).
 *
 * Les décorateurs @ApiProperty() permettent à Swagger de documenter
 * la forme exacte des réponses.
 */
export class ArticleResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Introduction à NestJS' })
  title!: string;

  @ApiProperty({ example: 'introduction-a-nestjs' })
  slug!: string;

  @ApiProperty({ example: 'NestJS est un framework...' })
  content!: string;

  @ApiProperty({ enum: ArticleStatus, example: ArticleStatus.Draft })
  status!: ArticleStatus;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  authorId!: string;

  @ApiPropertyOptional({ example: '2026-07-14T10:00:00.000Z', nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ example: '2026-07-14T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-14T10:00:00.000Z' })
  updatedAt!: Date;

  /**
   * Méthode statique de mapping : convertit un objet de domaine Article
   * en ArticleResponseDto prêt à être sérialisé en JSON.
   *
   * Pourquoi static fromDomain() plutôt que Object.assign() ?
   *   → On contrôle explicitement quels champs sont copiés.
   *   → Si on ajoute un champ sensible à Article (ex: internalNotes),
   *     il n'apparaîtra pas dans la réponse automatiquement.
   *   → On peut transformer les données (formatter une date, etc.).
   */
  static fromDomain(article: Article): ArticleResponseDto {
    const dto = new ArticleResponseDto();
    dto.id = article.id;
    dto.title = article.title;
    dto.slug = article.slug;
    dto.content = article.content;
    dto.status = article.status;
    dto.authorId = article.authorId;
    dto.publishedAt = article.publishedAt;
    dto.createdAt = article.createdAt;
    dto.updatedAt = article.updatedAt;
    return dto;
  }
}
```

---

### 4.3 Le contrôleur

**Fichier** : `src/modules/articles/presentation/articles.controller.ts`

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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { CreateArticleUseCase } from '../application/create-article.use-case';
import { DeleteArticleUseCase } from '../application/delete-article.use-case';
import { GetArticleByIdUseCase } from '../application/get-article-by-id.use-case';
import { ListArticlesUseCase } from '../application/list-articles.use-case';
import { UpdateArticleUseCase } from '../application/update-article.use-case';
import { ArticleQueryDto } from './dto/article-query.dto';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Article } from '../domain/article';

/**
 * Contrôleur REST du module articles.
 *
 * @ApiTags('Articles')
 *   → Regroupe tous ces endpoints sous le tag "Articles" dans Swagger.
 *     Sans ce décorateur, ils apparaissent dans "default".
 *
 * @ApiBearerAuth()
 *   → Indique à Swagger que ces endpoints nécessitent un JWT Bearer.
 *     N'applique PAS la protection — c'est JwtAuthGuard (global) qui le fait.
 *     Ce décorateur est uniquement documentaire.
 *
 * @Controller('articles')
 *   → Préfixe de toutes les routes de ce contrôleur.
 *     Combiné avec le préfixe global /api et la version /v1,
 *     les routes deviennent /api/v1/articles/...
 */
@ApiTags('Articles')
@ApiBearerAuth()
@Controller('articles')
export class ArticlesController {
  /**
   * Injection des use cases via le constructeur.
   *
   * Le contrôleur NE connaît que les use cases, jamais les repositories.
   * C'est la garantie que la logique métier ne "fuite" pas dans le contrôleur.
   */
  constructor(
    private readonly createArticleUseCase: CreateArticleUseCase,
    private readonly getArticleByIdUseCase: GetArticleByIdUseCase,
    private readonly listArticlesUseCase: ListArticlesUseCase,
    private readonly updateArticleUseCase: UpdateArticleUseCase,
    private readonly deleteArticleUseCase: DeleteArticleUseCase,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/articles
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @ApiOperation({ summary: '...' })
   *   → Description courte dans Swagger.
   *
   * @ApiCreatedResponse({ type: ArticleResponseDto })
   *   → Documente la réponse 201 dans Swagger.
   *     NestJS n'utilise pas cette info à l'exécution, c'est purement documentaire.
   */
  @Post()
  @ApiOperation({ summary: 'Créer un article' })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  async create(
    /**
     * @Body() body: CreateArticleDto
     *   → NestJS désérialise le corps JSON de la requête en CreateArticleDto.
     *   → Le ValidationPipe global valide automatiquement ce DTO
     *     (voir les décorateurs @IsNotEmpty, @MaxLength dans create-article.dto.ts).
     *   → Si la validation échoue, NestJS renvoie 400 avant d'appeler cette méthode.
     */
    @Body() body: CreateArticleDto,

    /**
     * @CurrentUser() user: AuthenticatedUser
     *   → Décorateur custom qui extrait request.user (placé par JwtAuthGuard).
     *   → Contient { userId, sessionId }.
     *   → Si l'utilisateur n'est pas authentifié, JwtAuthGuard a déjà bloqué
     *     la requête avant d'arriver ici.
     */
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ArticleResponseDto> {
    const { article } = await this.createArticleUseCase.execute({
      title: body.title,
      content: body.content,
      slug: body.slug,
      // On passe l'UUID de l'utilisateur connecté comme auteur
      authorId: user.userId,
    });

    // On convertit l'objet de domaine en DTO de réponse.
    // Le contrôleur sait comment faire le mapping HTTP ← domaine.
    return ArticleResponseDto.fromDomain(article);
    // L'interceptor ResponseEnvelopeInterceptor va ensuite envelopper ce DTO :
    // { success: true, data: <ArticleResponseDto>, meta: { requestId, timestamp } }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/articles
  // ─────────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lister les articles (paginé)' })
  @ApiOkResponse({ type: ArticleResponseDto, isArray: true })
  async list(
    /**
     * @Query() query: ArticleQueryDto
     *   → NestJS lit les query parameters (?page=2&limit=10&status=published)
     *     et les désérialise en ArticleQueryDto.
     *   → @Type(() => Number) dans PaginationQueryDto convertit "2" (string)
     *     en 2 (number) grâce à class-transformer.
     */
    @Query() query: ArticleQueryDto,
  ): Promise<PaginatedResult<ArticleResponseDto>> {
    const result = await this.listArticlesUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      status: query.status,
      authorId: query.authorId,
    });

    // On mappe chaque Article (domaine) en ArticleResponseDto
    return {
      items: result.items.map(ArticleResponseDto.fromDomain),
      meta: result.meta,
    };
    // L'interceptor détecte que c'est un PaginatedResult et produit :
    // { success: true, data: [...], meta: { pagination: { page, limit, ... } } }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/articles/:id
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un article par son identifiant' })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiNotFoundResponse({ description: 'Article introuvable.' })
  async findOne(
    /**
     * @Param('id', ParseUUIDPipe) id: string
     *   → Extrait le paramètre :id de l'URL.
     *
     * ParseUUIDPipe
     *   → Valide que :id est bien un UUID valide (format 550e8400-...).
     *     Si ce n'est pas un UUID, renvoie 400 avant d'appeler le use case.
     *     Sans ce pipe, quelqu'un pourrait envoyer ?id=../../../etc/passwd.
     */
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ArticleResponseDto> {
    const article = await this.getArticleByIdUseCase.execute(id);
    return ArticleResponseDto.fromDomain(article);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /api/v1/articles/:id
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un article' })
  @ApiOkResponse({ type: ArticleResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateArticleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ArticleResponseDto> {
    const updated = await this.updateArticleUseCase.execute({
      id,
      title: body.title,
      content: body.content,
      status: body.status,
      updatedBy: user.userId,
    });

    return ArticleResponseDto.fromDomain(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/v1/articles/:id
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @HttpCode(HttpStatus.NO_CONTENT)
   *   → Force le code de retour à 204 No Content.
   *     Par défaut NestJS renvoie 200 pour les DELETE.
   *     204 est la convention REST pour "suppression réussie, rien à renvoyer".
   *
   * La méthode retourne void (rien). L'interceptor d'enveloppe détecte
   * le 204 et ne wrappe pas la réponse.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un article (soft delete)' })
  @ApiNoContentResponse({ description: 'Article supprimé.' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.deleteArticleUseCase.execute(id, user.userId);
    // On ne retourne rien : HTTP 204 signifie "succès sans corps de réponse"
  }
}
```

---

## Étape 5 — Le module NestJS

**Fichier** : `src/modules/articles/articles.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// On importe AuditModule pour que AuditService soit injectable dans les use cases.
import { AuditModule } from '../audit/audit.module';
import { CreateArticleUseCase } from './application/create-article.use-case';
import { DeleteArticleUseCase } from './application/delete-article.use-case';
import { GetArticleByIdUseCase } from './application/get-article-by-id.use-case';
import { ListArticlesUseCase } from './application/list-articles.use-case';
import { UpdateArticleUseCase } from './application/update-article.use-case';
import { ARTICLE_REPOSITORY } from './domain/article-repository.port';
import { ArticleEntity } from './infrastructure/entities/article.entity';
import { ArticleMapper } from './infrastructure/article.mapper';
import { TypeOrmArticleRepository } from './infrastructure/typeorm-article.repository';
import { ArticlesController } from './presentation/articles.controller';

/**
 * Module NestJS du domaine Articles.
 *
 * Ce fichier est le "câblage" du module. Il réunit :
 *   - les entités TypeORM à enregistrer (imports)
 *   - les providers (services, use cases, repositories)
 *   - les contrôleurs
 *   - ce que ce module exporte pour les autres modules
 */
@Module({
  imports: [
    /**
     * TypeOrmModule.forFeature([ArticleEntity])
     *   → Enregistre ArticleEntity dans le scope de ce module.
     *   → Permet l'injection de @InjectRepository(ArticleEntity) dans
     *     TypeOrmArticleRepository.
     *   → Sans cette ligne, @InjectRepository(ArticleEntity) planterait
     *     avec "No repository for ArticleEntity found".
     *   → TypeORM "auto-load" l'entité dans la connexion globale grâce
     *     à autoLoadEntities: true dans DatabaseModule.
     */
    TypeOrmModule.forFeature([ArticleEntity]),

    /**
     * AuditModule
     *   → On importe AuditModule pour avoir accès à AuditService.
     *   → AuditModule exporte AuditService (voir audit.module.ts).
     *   → Sans cet import, NestJS ne saurait pas résoudre la dépendance
     *     AuditService dans CreateArticleUseCase et les autres use cases.
     */
    AuditModule,
  ],

  providers: [
    /**
     * ArticleMapper
     *   → Injectable simple. NestJS l'instancie et l'injecte dans
     *     TypeOrmArticleRepository.
     */
    ArticleMapper,

    /**
     * Liaison Port → Implémentation concrète.
     *
     * provide: ARTICLE_REPOSITORY
     *   → Le Symbol qui sert de token d'injection.
     *
     * useClass: TypeOrmArticleRepository
     *   → La classe concrète que NestJS instanciera.
     *
     * Grâce à cette liaison, partout où on écrit :
     *   @Inject(ARTICLE_REPOSITORY) private readonly repo: ArticleRepositoryPort
     * NestJS injecte une instance de TypeOrmArticleRepository.
     *
     * Si demain on crée PostgresArticleRepository, on change juste useClass ici.
     */
    {
      provide: ARTICLE_REPOSITORY,
      useClass: TypeOrmArticleRepository,
    },

    /**
     * Les use cases sont déclarés comme providers simples (par classe).
     * NestJS les instancie, résout leurs dépendances (@Inject, injection
     * par type), et les met à disposition des contrôleurs.
     */
    CreateArticleUseCase,
    GetArticleByIdUseCase,
    ListArticlesUseCase,
    UpdateArticleUseCase,
    DeleteArticleUseCase,
  ],

  /**
   * controllers: [ArticlesController]
   *   → Déclare le contrôleur. NestJS enregistre automatiquement ses routes.
   *   → Un contrôleur ne va PAS dans providers[], il a son propre tableau.
   */
  controllers: [ArticlesController],

  /**
   * exports: []
   *   → Ce que ce module rend disponible aux modules qui l'importent.
   *   → Ici on n'exporte rien : les articles sont autonomes, pas d'autre
   *     module n'a besoin d'appeler nos use cases.
   *   → Si un autre module avait besoin de GetArticleByIdUseCase, on l'ajouterait ici.
   */
  exports: [],
})
export class ArticlesModule {}
```

---

## Étape 6 — Enregistrement dans AppModule

**Fichier** : `src/app.module.ts`

Il faut ajouter `ArticlesModule` dans la liste des imports du module racine.

```typescript
import { ArticlesModule } from './modules/articles/articles.module';
// ... autres imports existants

@Module({
  imports: [
    ConfigurationModule,
    ContextModule,
    LoggingModule,
    ThrottlingModule,
    DatabaseModule,
    UsersModule,
    AuthenticationModule,
    AuditModule,
    ObservabilityModule,
    HealthModule,
    MailModule,
    StorageModule,
    PdfModule,
    SchedulerModule,
    // ↓ Ajouter cette ligne
    ArticlesModule,
    ...(isTechnicalDemoEnabled() ? [TechnicalDemoModule] : []),
  ],
})
export class AppModule implements NestModule { ... }
```

---

## Étape 7 — Lancer la migration

```bash
# 1. Générer la migration automatiquement depuis les entités TypeORM
#    (TypeORM compare l'état de la base avec les entités et génère le diff)
npm run migration:generate -- --name CreateArticlesTable

# 2. Vérifier le fichier généré dans src/database/migrations/
#    S'assurer que le SQL est correct avant d'appliquer.

# 3. Appliquer la migration sur la base locale
npm run migration:run

# 4. Appliquer sur la base de test (pour les tests d'intégration)
npm run migration:run:test

# 5. Vérifier que tout compile
npm run build
```

---

## 10. Récapitulatif des fichiers créés

| Fichier | Couche | Rôle |
|---|---|---|
| `domain/article-status.enum.ts` | Domain | Valeurs possibles du statut |
| `domain/article.ts` | Domain | Entité pure + règles métier + generateSlug() |
| `domain/article-repository.port.ts` | Domain | Interface + interfaces de paramètres + Symbol |
| `infrastructure/entities/article.entity.ts` | Infrastructure | Mapping TypeORM → table SQL |
| `infrastructure/article.mapper.ts` | Infrastructure | Conversion Entity ↔ Domain |
| `infrastructure/typeorm-article.repository.ts` | Infrastructure | Implémentation SQL des requêtes |
| `application/create-article.use-case.ts` | Application | Orchestration création + audit |
| `application/get-article-by-id.use-case.ts` | Application | Récupération ou 404 |
| `application/list-articles.use-case.ts` | Application | Liste paginée |
| `application/update-article.use-case.ts` | Application | Mise à jour + règles (publication) |
| `application/delete-article.use-case.ts` | Application | Soft delete + audit |
| `presentation/dto/create-article.dto.ts` | Presentation | Validation du body POST |
| `presentation/dto/update-article.dto.ts` | Presentation | Validation du body PATCH |
| `presentation/dto/article-query.dto.ts` | Presentation | Validation des query params GET |
| `presentation/dto/article-response.dto.ts` | Presentation | Shape de la réponse + mapping |
| `presentation/articles.controller.ts` | Presentation | Routes HTTP + appel des use cases |
| `articles.module.ts` | Module | Câblage NestJS de toutes les pièces |

Migration à créer dans `src/database/migrations/`.
Ajouter `ArticlesModule` dans `src/app.module.ts`.

---

## 11. Schéma des dépendances

```
HTTP Request
     │
     ▼
ArticlesController          ← connaît les use cases, les DTOs
     │
     ├─ CreateArticleUseCase
     ├─ GetArticleByIdUseCase
     ├─ ListArticlesUseCase  ← connaissent ArticleRepositoryPort (interface)
     ├─ UpdateArticleUseCase    et AuditService
     └─ DeleteArticleUseCase
              │
              │  (injection via Symbol ARTICLE_REPOSITORY)
              │
              ▼
TypeOrmArticleRepository    ← connaît ArticleEntity, ArticleMapper, TypeORM
              │
              ▼
ArticleEntity               ← connaît TypeORM, AuditableEntity, ArticleStatus
         (SQL Server)
              │
              ▼
    Table `articles`


Direction des dépendances (ce qui doit être respecté) :
──────────────────────────────────────────────────────
Presentation  →  Application  →  Domain
Infrastructure  →  Domain
Infrastructure  →  Application (implémente les contrats)

Ce qui est INTERDIT :
  Domain        →  Infrastructure  ✗
  Domain        →  NestJS/TypeORM  ✗
  Application   →  Controller      ✗
  Application   →  TypeORM direct  ✗
```

---

*Guide rédigé le 14 juillet 2026 — synchronisé avec les patterns du projet.*
