# mini-DEV-03 · Catalogue (Produits & Services) — l'essentiel pour démarrer

> **Spec couverte** : `specs/03-catalogue-produits-services/03-catalogue-produits-services.md` (version minimale)
> **Niveau** : 🟢 fonctionnel — même logique que les `mini-DEV-01/02` (voir `RECAP-DEV-01` pour la philosophie des 3 niveaux).
> **Prérequis** : `mini-DEV-01` terminé (rôles, `@Roles()`, exceptions). Le module 02 n'est PAS un prérequis technique, mais tu es censé en connaître le patron : ce guide va plus vite sur ce qui a déjà été expliqué deux fois.
> **Promesse** : à la fin, un catalogue complet — catégories hiérarchiques (1 niveau de sous-catégories) + produits/services avec prix, TVA et SKU auto-généré. 10 routes dans Swagger. Environ 2 h 30.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — Le domaine : 2 enums, 2 entités, 2 ports](#étape-1--le-domaine--2-enums-2-entités-2-ports)
- [Étape 2 — Le transformer `decimal` (les prix, enfin !)](#étape-2--le-transformer-decimal-les-prix-enfin-)
- [Étape 3 — Les entités TypeORM (avec relations) et les mappers](#étape-3--les-entités-typeorm-avec-relations-et-les-mappers)
- [Étape 4 — La migration](#étape-4--la-migration)
- [Étape 5 — Les repositories](#étape-5--les-repositories)
- [Étape 6 — Les cas d'utilisation (5 + 5)](#étape-6--les-cas-dutilisation-5--5)
- [Étape 7 — Les DTOs](#étape-7--les-dtos)
- [Étape 8 — Les deux contrôleurs](#étape-8--les-deux-contrôleurs)
- [Étape 9 — Le module + AppModule](#étape-9--le-module--appmodule)
- [Étape 10 — Vérifier que ça marche & ce qu'on verra plus tard](#étape-10--vérifier-que-ça-marche--ce-quon-verra-plus-tard)

---

## 0 · Avant de commencer

- API démarrée (`npm run start:dev`), base à jour (`npm run migration:run`), `admin@local.dev` en ADMIN.
- Pour les rappels sur le socle (architecture, enveloppe, exceptions, pagination) : section A de `mini-DEV-01`.

### Les nouveautés de ce module

C'est le premier module avec **deux entités reliées** : un produit appartient (optionnellement) à une catégorie, et une catégorie peut avoir une catégorie parente (sous-catégories, 1 niveau max). Tu vas donc découvrir :

1. les **relations TypeORM** (`@ManyToOne` / `@JoinColumn`) et les **clés étrangères** qu'elles génèrent ;
2. le **self-join** (une table qui pointe vers elle-même, pour la hiérarchie de catégories) ;
3. le type SQL **`decimal(12,2)`** pour les prix — et son piège n°1 (le driver le renvoie en *chaîne*, pas en nombre) réglé une fois pour toutes par un « transformer » réutilisable ;
4. une liste **non paginée** (les catégories : quelques dizaines de lignes max, la pagination serait du bruit) ;
5. la **génération automatique de SKU** (`PROD-0001`, `PROD-0002`…).

---

## B · Ce qu'on va construire

Le catalogue distingue deux types d'articles : **PRODUCT** (bien physique, aura du stock au module 04) et **SERVICE** (prestation, jamais de stock).

**Côté catégories (`/categories`)** — liste plate avec `parentId`, 1 niveau de sous-catégories max :

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/categories` | tout connecté | Liste (non paginée), filtre `isActive` |
| `GET /api/v1/categories/:id` | tout connecté | Détail |
| `POST /api/v1/categories` | ADMIN, MANAGER | Créer (vérifie le parent) |
| `PATCH /api/v1/categories/:id` | ADMIN, MANAGER | Modifier |
| `DELETE /api/v1/categories/:id` | ADMIN | Supprimer — refusé (409) si sous-catégories ou produits rattachés |

**Côté produits (`/products`)** :

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/products` | tout connecté | Liste paginée ; filtres `categoryId`, `type`, `isActive`, `search` (SKU / nom) |
| `GET /api/v1/products/:id` | tout connecté | Détail |
| `POST /api/v1/products` | ADMIN, MANAGER | Créer — SKU auto-généré si absent, unicité vérifiée (409) |
| `PATCH /api/v1/products/:id` | ADMIN, MANAGER | Modifier (unicité du SKU re-vérifiée s'il change) |
| `DELETE /api/v1/products/:id` | ADMIN | Désactiver (soft-delete, 204) |

**Fichiers créés (23)** :

```
src/common/database/decimal-column.transformer.ts        ← réutilisé par les modules 05 à 08
src/modules/catalogue/domain/product-type.enum.ts
src/modules/catalogue/domain/product-unit.enum.ts
src/modules/catalogue/domain/category.ts
src/modules/catalogue/domain/product.ts
src/modules/catalogue/domain/category-repository.port.ts
src/modules/catalogue/domain/product-repository.port.ts
src/modules/catalogue/infrastructure/entities/category.entity.ts
src/modules/catalogue/infrastructure/entities/product.entity.ts
src/modules/catalogue/infrastructure/category.mapper.ts
src/modules/catalogue/infrastructure/product.mapper.ts
src/modules/catalogue/infrastructure/typeorm-category.repository.ts
src/modules/catalogue/infrastructure/typeorm-product.repository.ts
src/modules/catalogue/application/…                       ← 10 use cases (5 catégories + 5 produits)
src/modules/catalogue/presentation/dto/…                  ← 6 DTOs
src/modules/catalogue/presentation/categories.controller.ts
src/modules/catalogue/presentation/products.controller.ts
src/modules/catalogue/catalogue.module.ts
src/database/migrations/<timestamp>-CreateCatalogueTables.ts   (générée)
```

**Fichier modifié (1)** : `src/app.module.ts`.

**Différé** (détail à l'étape 10) : l'upload d'image (`POST /products/:id/image` via le StorageModule → min-), le blocage de suppression si le produit figure dans des devis/commandes actifs (impossible avant les modules 05/06), l'objet `category` embarqué dans la réponse produit (min-), l'audit, les tests.

---

## Étape 1 — Le domaine : 2 enums, 2 entités, 2 ports

> Crée l'arborescence `src/modules/catalogue/domain/`.

### ➕ Créer `src/modules/catalogue/domain/product-type.enum.ts`

```typescript
/**
 * Nature d'un article du catalogue.
 *
 * PRODUCT : bien physique — aura des niveaux de stock (module 04) et
 *           génèrera des mouvements lors des livraisons (module 06).
 * SERVICE : prestation — facturable mais JAMAIS de stock.
 */
export enum ProductType {
  Product = 'PRODUCT',
  Service = 'SERVICE',
}
```

### ➕ Créer `src/modules/catalogue/domain/product-unit.enum.ts`

```typescript
/** Unité de vente d'un article (affichée sur devis et factures). */
export enum ProductUnit {
  Unit = 'UNIT', // pièce
  Kg = 'KG',
  Liter = 'LITER',
  Hour = 'HOUR',
  Day = 'DAY',
  Meter = 'METER',
}
```

### ➕ Créer `src/modules/catalogue/domain/category.ts`

```typescript
/**
 * Catégorie de produits — hiérarchie simple à 1 niveau :
 * une catégorie racine peut avoir des sous-catégories, une
 * sous-catégorie ne peut pas en avoir (règle vérifiée en use case).
 */
export class Category {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    /** null = catégorie racine ; sinon id de la catégorie parente. */
    public readonly parentId: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  isRoot(): boolean {
    return this.parentId === null;
  }
}
```

### ➕ Créer `src/modules/catalogue/domain/product.ts`

```typescript
import { ProductType } from './product-type.enum';
import { ProductUnit } from './product-unit.enum';

/**
 * Article du catalogue (bien physique ou prestation).
 *
 * Les prix sont des montants HT en EUR, portés par des colonnes SQL
 * decimal(12,2) — jamais de float (imprécisions binaires interdites
 * quand on parle d'argent).
 */
export class Product {
  constructor(
    public readonly id: string,
    /** Référence unique, normalisée en MAJUSCULES (ex. : PROD-0001). */
    public readonly sku: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly type: ProductType,
    public readonly categoryId: string | null,
    /** Prix de vente HT en EUR. */
    public readonly unitPrice: number,
    /** Prix d'achat HT en EUR (calcul de marge), si connu. */
    public readonly purchasePrice: number | null,
    /** Taux de TVA en % (0, 5.5, 10 ou 20). */
    public readonly vatRate: number,
    public readonly unit: ProductUnit,
    public readonly isActive: boolean,
    public readonly imageUrl: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  /**
   * Seuls les biens physiques ont un stock. Les modules 04 (stocks) et
   * 06 (commandes) s'appuieront sur cette méthode pour ignorer les
   * services dans les mouvements.
   */
  isStockManaged(): boolean {
    return this.type === ProductType.Product;
  }
}
```

### ➕ Créer `src/modules/catalogue/domain/category-repository.port.ts`

```typescript
import { Category } from './category';

/** Filtres de listing des catégories (liste courte : pas de pagination). */
export interface ListCategoriesFilters {
  isActive?: boolean;
}

/** Données de création d'une catégorie. */
export interface CreateCategoryData {
  name: string;
  description: string | null;
  parentId: string | null;
}

/** Champs modifiables d'une catégorie. */
export interface UpdateCategoryData {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}

/**
 * Contrat de persistance des catégories.
 * Les recherches excluent les catégories supprimées logiquement.
 */
export interface CategoryRepositoryPort {
  /** Liste plate (le front reconstitue l'arbre via parentId). */
  findAll(filters: ListCategoriesFilters): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  create(data: CreateCategoryData): Promise<Category>;
  update(id: string, data: UpdateCategoryData): Promise<Category>;
  softDelete(id: string): Promise<void>;
  /** True si au moins un produit (non supprimé) référence la catégorie. */
  hasProducts(id: string): Promise<boolean>;
  /** True si au moins une sous-catégorie (non supprimée) existe. */
  hasChildren(id: string): Promise<boolean>;
}

/** Jeton d'injection du repository catégories. */
export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
```

### ➕ Créer `src/modules/catalogue/domain/product-repository.port.ts`

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Product } from './product';
import { ProductType } from './product-type.enum';
import { ProductUnit } from './product-unit.enum';

/** Critères de listing des produits. */
export interface ListProductsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur sku et name. */
  search?: string;
  categoryId?: string;
  type?: ProductType;
  isActive?: boolean;
}

/** Données de création (SKU déjà résolu — fourni ou auto-généré). */
export interface CreateProductData {
  sku: string;
  name: string;
  description: string | null;
  type: ProductType;
  categoryId: string | null;
  unitPrice: number;
  purchasePrice: number | null;
  vatRate: number;
  unit: ProductUnit;
}

/** Champs modifiables d'un produit. */
export interface UpdateProductData {
  sku?: string;
  name?: string;
  description?: string | null;
  type?: ProductType;
  categoryId?: string | null;
  unitPrice?: number;
  purchasePrice?: number | null;
  vatRate?: number;
  unit?: ProductUnit;
  isActive?: boolean;
}

/**
 * Contrat de persistance des produits.
 * Les recherches excluent les produits supprimés logiquement.
 */
export interface ProductRepositoryPort {
  findAll(query: ListProductsQuery): Promise<PaginatedResult<Product>>;
  findById(id: string): Promise<Product | null>;
  /** Recherche par SKU (déjà normalisé en majuscules par l'appelant). */
  findBySku(sku: string): Promise<Product | null>;
  /**
   * Nombre total de produits Y COMPRIS supprimés : sert à générer le
   * prochain SKU auto (la séquence ne doit jamais redescendre, sinon un
   * SKU déjà attribué pourrait être régénéré).
   */
  countAllIncludingDeleted(): Promise<number>;
  create(data: CreateProductData): Promise<Product>;
  update(id: string, data: UpdateProductData): Promise<Product>;
  softDelete(id: string): Promise<void>;
}

/** Jeton d'injection du repository produits. */
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 2 — Le transformer `decimal` (les prix, enfin !)

### Le piège n°1 de l'argent en base de données

Deux choses à graver dans le marbre :

1. **JAMAIS de `float`/`double` pour de l'argent.** En binaire, `0.1 + 0.2 = 0.30000000000000004`. Sur une facture, c'est inacceptable. On utilise le type SQL `decimal(12,2)` : 12 chiffres dont 2 décimales, exact.
2. **Le driver SQL renvoie les `decimal` en STRING** (`"49.90"` et pas `49.90`) — précisément pour ne pas perdre la précision en passant par un float JavaScript. Sans traitement, `product.unitPrice + 10` donnerait `"49.9010"` (concaténation !) 🙀

La parade : un **transformer** TypeORM — un petit objet branché sur la colonne qui convertit à la volée dans les deux sens. Pour des montants à 2 décimales dans les ordres de grandeur d'un ERP, la conversion en `number` est sans risque. On le range dans `src/common/` : les modules 05 à 08 (devis, commandes, factures, paiements) en auront besoin pour tous leurs totaux.

### ➕ Créer `src/common/database/decimal-column.transformer.ts`

> Crée le dossier `src/common/database/`.

```typescript
import { ValueTransformer } from 'typeorm';

/**
 * Conversion des colonnes SQL decimal <-> number JavaScript.
 *
 * Le driver mssql renvoie les decimal en string pour préserver la
 * précision. Pour les montants de cet ERP (2 décimales, magnitudes
 * d'un ERP de gestion), la conversion en number est sans perte et
 * beaucoup plus pratique (calculs, JSON).
 *
 * Usage :
 *   @Column({ type: 'decimal', precision: 12, scale: 2,
 *             transformer: new DecimalColumnTransformer() })
 */
export class DecimalColumnTransformer implements ValueTransformer {
  /** JS -> SQL : TypeORM sait sérialiser un number, rien à faire. */
  to(value: number | null): number | null {
    return value;
  }

  /** SQL -> JS : "49.90" (string) devient 49.9 (number). */
  from(value: string | null): number | null {
    return value === null ? null : Number(value);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 3 — Les entités TypeORM (avec relations) et les mappers

> Crée l'arborescence `src/modules/catalogue/infrastructure/entities/`.

### ➕ Créer `src/modules/catalogue/infrastructure/entities/category.entity.ts`

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';

/**
 * Entité TypeORM de la table `categories`.
 *
 * Self-join : parent_id référence categories.id (clé étrangère générée
 * par la relation @ManyToOne ci-dessous). La règle « 1 niveau de
 * sous-catégories maximum » est applicative (use case), pas SQL.
 */
@Entity({ name: 'categories' })
export class CategoryEntity extends AuditableEntity {
  @Index('IX_categories_name')
  @Column({ name: 'name', type: 'nvarchar', length: 100 })
  name!: string;

  @Column({
    name: 'description',
    type: 'nvarchar',
    length: 500,
    nullable: true,
  })
  description!: string | null;

  /**
   * Colonne FK exposée telle quelle : le code lit/écrit l'UUID
   * directement, sans charger l'objet parent.
   */
  @Column({ name: 'parent_id', type: 'uniqueidentifier', nullable: true })
  parentId!: string | null;

  /**
   * Relation vers la catégorie parente — déclarée pour que TypeORM crée
   * la CLÉ ÉTRANGÈRE en base (une sous-catégorie ne peut pas pointer
   * vers un id inexistant). Le code applicatif n'utilise que parentId.
   */
  @ManyToOne(() => CategoryEntity, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: CategoryEntity | null;

  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;
}
```

### ➕ Créer `src/modules/catalogue/infrastructure/entities/product.entity.ts`

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { ProductType } from '../../domain/product-type.enum';
import { ProductUnit } from '../../domain/product-unit.enum';
import { CategoryEntity } from './category.entity';

/**
 * Entité TypeORM de la table `products`.
 *
 * Prix en decimal(12,2) avec transformer (voir
 * common/database/decimal-column.transformer.ts) : JAMAIS de float
 * pour de l'argent.
 */
@Entity({ name: 'products' })
export class ProductEntity extends AuditableEntity {
  /** Référence unique, normalisée en MAJUSCULES par la couche application. */
  @Index('UQ_products_sku', { unique: true })
  @Column({ name: 'sku', type: 'nvarchar', length: 30 })
  sku!: string;

  @Index('IX_products_name')
  @Column({ name: 'name', type: 'nvarchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'nvarchar', length: 'max', nullable: true })
  description!: string | null;

  @Index('IX_products_type')
  @Column({ name: 'type', type: 'nvarchar', length: 10 })
  type!: ProductType;

  /** FK exposée directement (même pattern que CategoryEntity.parentId). */
  @Column({ name: 'category_id', type: 'uniqueidentifier', nullable: true })
  categoryId!: string | null;

  /** Relation déclarée pour la clé étrangère category_id -> categories. */
  @ManyToOne(() => CategoryEntity, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: CategoryEntity | null;

  /** Prix de vente HT en EUR. */
  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  unitPrice!: number;

  /** Prix d'achat HT en EUR (marge), si connu. */
  @Column({
    name: 'purchase_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: new DecimalColumnTransformer(),
  })
  purchasePrice!: number | null;

  /** Taux de TVA en % (0, 5.5, 10, 20 — validé par le DTO). */
  @Column({
    name: 'vat_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 20,
    transformer: new DecimalColumnTransformer(),
  })
  vatRate!: number;

  @Column({ name: 'unit', type: 'nvarchar', length: 10 })
  unit!: ProductUnit;

  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;

  /** URL de l'image produit (upload branché au niveau min-). */
  @Column({ name: 'image_url', type: 'nvarchar', length: 500, nullable: true })
  imageUrl!: string | null;
}
```

> 💡 **Le pattern « colonne FK + relation »** : on déclare `categoryId` (la colonne, que le code manipule) ET `category` (la relation, qui ne sert qu'à générer la clé étrangère SQL et, plus tard, aux jointures). Les deux pointent sur la même colonne `category_id` via `@JoinColumn`. C'est LE pattern à retenir pour tous les modules suivants (devis → contact, commandes → produits…).
>
> 📌 On garde la colonne `image_url` dès maintenant **même si l'upload est différé** : le schéma est complet, aucune migration supplémentaire ne sera nécessaire en montant au niveau min-.

### ➕ Créer `src/modules/catalogue/infrastructure/category.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Category } from '../domain/category';
import { CategoryEntity } from './entities/category.entity';

/** Conversion entité TypeORM <-> modèle de domaine. */
@Injectable()
export class CategoryMapper {
  toDomain(entity: CategoryEntity): Category {
    return new Category(
      entity.id,
      entity.name,
      entity.description,
      entity.parentId,
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
```

### ➕ Créer `src/modules/catalogue/infrastructure/product.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Product } from '../domain/product';
import { ProductEntity } from './entities/product.entity';

/** Conversion entité TypeORM <-> modèle de domaine. */
@Injectable()
export class ProductMapper {
  toDomain(entity: ProductEntity): Product {
    return new Product(
      entity.id,
      entity.sku,
      entity.name,
      entity.description,
      entity.type,
      entity.categoryId,
      entity.unitPrice,
      entity.purchasePrice,
      entity.vatRate,
      entity.unit,
      entity.isActive,
      entity.imageUrl,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 4 — La migration

Deux nouvelles tables → migration **générée** (comme au module 02) :

```bash
npm run migration:generate -- src/database/migrations/CreateCatalogueTables
```

**Relis le fichier généré** avant d'exécuter. Tu dois y trouver :

- `CREATE TABLE "categories"` (avec `parent_id` nullable) puis `CREATE TABLE "products"` ;
- les index : `IX_categories_name`, `UQ_products_sku` (**unique**), `IX_products_name`, `IX_products_type` ;
- les défauts : `vat_rate DEFAULT 20`, `is_active DEFAULT 1` ;
- **deux `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`** : `categories.parent_id → categories.id` (le self-join !) et `products.category_id → categories.id` — c'est la concrétisation des relations `@ManyToOne` de l'étape 3 ;
- un `down()` qui défait tout dans l'ordre inverse (contraintes d'abord, tables ensuite) ;
- RIEN sur les tables `users` ou `contacts`.

Puis :

```bash
npm run migration:run
npm run migration:show   # CreateCatalogueTables cochée [X]
```

**✅ Point de contrôle** : la table `products` existe avec ses FK (visible dans ton client SQL, section « Keys »).

---

## Étape 5 — Les repositories

### ➕ Créer `src/modules/catalogue/infrastructure/typeorm-category.repository.ts`

Nouveauté : ce repository interroge **deux tables** (il a besoin de savoir si des produits référencent la catégorie). On lui injecte donc les deux `Repository` TypeORM.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Category } from '../domain/category';
import {
  CategoryRepositoryPort,
  CreateCategoryData,
  ListCategoriesFilters,
  UpdateCategoryData,
} from '../domain/category-repository.port';
import { CategoryEntity } from './entities/category.entity';
import { ProductEntity } from './entities/product.entity';
import { CategoryMapper } from './category.mapper';

/**
 * Implémentation TypeORM du repository catégories.
 *
 * Volume faible (quelques dizaines de lignes) : l'API simple
 * repository.find() suffit — pas besoin du QueryBuilder ici.
 */
@Injectable()
export class TypeOrmCategoryRepository implements CategoryRepositoryPort {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repository: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    private readonly mapper: CategoryMapper,
  ) {}

  async findAll(filters: ListCategoriesFilters): Promise<Category[]> {
    const where: FindOptionsWhere<CategoryEntity> = {};
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const entities = await this.repository.find({
      where,
      order: { name: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findById(id: string): Promise<Category | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async create(data: CreateCategoryData): Promise<Category> {
    const entity = await this.repository.save(
      this.repository.create({ ...data, isActive: true }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    // undefined = « non fourni » : seuls les champs présents sont écrits.
    const changes: Partial<CategoryEntity> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (changes as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }

    const entity = await this.repository.findOne({ where: { id } });
    // L'appelant (use case) a vérifié l'existence avant de modifier.
    return this.mapper.toDomain(entity as CategoryEntity);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: false });
    await this.repository.softDelete({ id });
  }

  hasProducts(id: string): Promise<boolean> {
    // exists() exclut d'office les produits soft-deletés.
    return this.productRepository.exists({ where: { categoryId: id } });
  }

  hasChildren(id: string): Promise<boolean> {
    return this.repository.exists({ where: { parentId: id } });
  }
}
```

### ➕ Créer `src/modules/catalogue/infrastructure/typeorm-product.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { Product } from '../domain/product';
import {
  CreateProductData,
  ListProductsQuery,
  ProductRepositoryPort,
  UpdateProductData,
} from '../domain/product-repository.port';
import { ProductEntity } from './entities/product.entity';
import { ProductMapper } from './product.mapper';

/** Liste blanche de tri (anti-injection, cf. modules 01 et 02). */
const PRODUCT_SORTABLE_COLUMNS: ColumnWhitelist = {
  sku: 'product.sku',
  name: 'product.name',
  type: 'product.type',
  unitPrice: 'product.unitPrice',
  vatRate: 'product.vatRate',
  isActive: 'product.isActive',
  createdAt: 'product.createdAt',
};

/** Colonnes parcourues par la recherche textuelle. */
const PRODUCT_SEARCHABLE_COLUMNS = ['product.sku', 'product.name'] as const;

/**
 * Implémentation TypeORM du repository produits.
 * Les recherches standard excluent les lignes soft-deletées.
 */
@Injectable()
export class TypeOrmProductRepository implements ProductRepositoryPort {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repository: Repository<ProductEntity>,
    private readonly mapper: ProductMapper,
  ) {}

  async findAll(query: ListProductsQuery): Promise<PaginatedResult<Product>> {
    const queryBuilder = this.repository.createQueryBuilder('product');

    if (query.categoryId !== undefined) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.type !== undefined) {
      queryBuilder.andWhere('product.type = :type', { type: query.type });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('product.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      PRODUCT_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('product.name', SortDirection.Asc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        PRODUCT_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Product | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const entity = await this.repository.findOne({ where: { sku } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  countAllIncludingDeleted(): Promise<number> {
    // withDeleted : la séquence de SKU auto ne redescend jamais, même
    // après suppression de produits.
    return this.repository.count({ withDeleted: true });
  }

  async create(data: CreateProductData): Promise<Product> {
    const entity = await this.repository.save(
      this.repository.create({ ...data, isActive: true }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateProductData): Promise<Product> {
    const changes: Partial<ProductEntity> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (changes as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }

    const entity = await this.repository.findOne({ where: { id } });
    return this.mapper.toDomain(entity as ProductEntity);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: false });
    await this.repository.softDelete({ id });
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 6 — Les cas d'utilisation (5 + 5)

> Crée le dossier `src/modules/catalogue/application/`.

### Les 5 use cases Catégories

### ➕ Créer `src/modules/catalogue/application/list-categories.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Category } from '../domain/category';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type {
  CategoryRepositoryPort,
  ListCategoriesFilters,
} from '../domain/category-repository.port';

/**
 * Cas d'utilisation : lister les catégories.
 * Retourne la liste PLATE (avec parentId) : c'est au consommateur
 * (front) de reconstituer l'arbre — plus simple et plus flexible
 * qu'un JSON imbriqué.
 */
@Injectable()
export class ListCategoriesUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  execute(filters: ListCategoriesFilters): Promise<Category[]> {
    return this.categoryRepository.findAll(filters);
  }
}
```

### ➕ Créer `src/modules/catalogue/application/get-category-by-id.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Category } from '../domain/category';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type { CategoryRepositoryPort } from '../domain/category-repository.port';

/** Cas d'utilisation : récupérer une catégorie (404 si inconnue). */
@Injectable()
export class GetCategoryByIdUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(categoryId: string): Promise<Category> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new ResourceNotFoundException('La catégorie');
    }
    return category;
  }
}
```

### ➕ Créer `src/modules/catalogue/application/create-category.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { Category } from '../domain/category';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type { CategoryRepositoryPort } from '../domain/category-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateCategoryInput {
  name: string;
  description?: string;
  parentId?: string;
}

/**
 * Cas d'utilisation : créer une catégorie.
 *
 * Règles :
 *   - le parent, s'il est fourni, doit exister ;
 *   - le parent doit être une catégorie RACINE : un seul niveau de
 *     sous-catégories (choix de la spec, suffisant pour un catalogue
 *     de démonstration et beaucoup plus simple à afficher).
 */
@Injectable()
export class CreateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    if (input.parentId !== undefined) {
      const parent = await this.categoryRepository.findById(input.parentId);
      if (!parent) {
        throw new ResourceNotFoundException('La catégorie parente');
      }
      if (!parent.isRoot()) {
        throw new BusinessRuleViolationException(
          'Un seul niveau de sous-catégories est autorisé : la catégorie ' +
            'parente est déjà une sous-catégorie.',
        );
      }
    }

    return this.categoryRepository.create({
      name: input.name.trim(),
      description: input.description ?? null,
      parentId: input.parentId ?? null,
    });
  }
}
```

### ➕ Créer `src/modules/catalogue/application/update-category.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { Category } from '../domain/category';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type {
  CategoryRepositoryPort,
  UpdateCategoryData,
} from '../domain/category-repository.port';

/** Champs modifiables (sémantique PATCH). */
export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  parentId?: string;
  isActive?: boolean;
}

/**
 * Cas d'utilisation : modifier une catégorie.
 * Mêmes règles de hiérarchie qu'à la création, plus une évidente mais
 * indispensable : une catégorie ne peut pas devenir sa propre parente.
 */
@Injectable()
export class UpdateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new ResourceNotFoundException('La catégorie');
    }

    if (input.parentId !== undefined) {
      // UUID SQL Server en majuscules vs saisie client : comparaison
      // insensible à la casse (cf. modules 01 et 02).
      if (input.parentId.toLowerCase() === categoryId.toLowerCase()) {
        throw new BusinessRuleViolationException(
          'Une catégorie ne peut pas être sa propre parente.',
        );
      }
      const parent = await this.categoryRepository.findById(input.parentId);
      if (!parent) {
        throw new ResourceNotFoundException('La catégorie parente');
      }
      if (!parent.isRoot()) {
        throw new BusinessRuleViolationException(
          'Un seul niveau de sous-catégories est autorisé : la catégorie ' +
            'parente est déjà une sous-catégorie.',
        );
      }
    }

    const changes: UpdateCategoryData = { ...input };
    if (input.name !== undefined) {
      changes.name = input.name.trim();
    }

    return this.categoryRepository.update(categoryId, changes);
  }
}
```

### ➕ Créer `src/modules/catalogue/application/delete-category.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type { CategoryRepositoryPort } from '../domain/category-repository.port';

/**
 * Cas d'utilisation : supprimer (logiquement) une catégorie.
 *
 * Deux règles d'intégrité, vérifiées AVANT la suppression :
 *   - pas de sous-catégories rattachées (elles deviendraient orphelines) ;
 *   - pas de produits rattachés (leur category_id pointerait dans le
 *     vide fonctionnellement — et la clé étrangère SQL transformerait
 *     de toute façon l'oubli en erreur 500 incompréhensible).
 * Un message 409 clair vaut toujours mieux qu'une erreur SQL.
 */
@Injectable()
export class DeleteCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(categoryId: string): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new ResourceNotFoundException('La catégorie');
    }

    if (await this.categoryRepository.hasChildren(categoryId)) {
      throw new BusinessRuleViolationException(
        'Impossible de supprimer cette catégorie : elle possède des ' +
          'sous-catégories.',
      );
    }
    if (await this.categoryRepository.hasProducts(categoryId)) {
      throw new BusinessRuleViolationException(
        'Impossible de supprimer cette catégorie : des produits y sont ' +
          'rattachés.',
      );
    }

    await this.categoryRepository.softDelete(categoryId);
  }
}
```

### Les 5 use cases Produits

### ➕ Créer `src/modules/catalogue/application/list-products.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Product } from '../domain/product';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type {
  ListProductsQuery,
  ProductRepositoryPort,
} from '../domain/product-repository.port';

/** Cas d'utilisation : lister les produits (pagination + filtres). */
@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  execute(query: ListProductsQuery): Promise<PaginatedResult<Product>> {
    return this.productRepository.findAll(query);
  }
}
```

### ➕ Créer `src/modules/catalogue/application/get-product-by-id.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Product } from '../domain/product';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type { ProductRepositoryPort } from '../domain/product-repository.port';

/**
 * Cas d'utilisation : récupérer un produit (404 si inconnu).
 * Sera réutilisé par les modules 04 (stocks), 05 (devis) et 06
 * (commandes) pour valider leurs lignes.
 */
@Injectable()
export class GetProductByIdUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(productId: string): Promise<Product> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ResourceNotFoundException('Le produit');
    }
    return product;
  }
}
```

### ➕ Créer `src/modules/catalogue/application/create-product.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceAlreadyExistsException, ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type { CategoryRepositoryPort } from '../domain/category-repository.port';
import { Product } from '../domain/product';
import { ProductType } from '../domain/product-type.enum';
import { ProductUnit } from '../domain/product-unit.enum';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type { ProductRepositoryPort } from '../domain/product-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateProductInput {
  sku?: string;
  name: string;
  description?: string;
  type: ProductType;
  categoryId?: string;
  unitPrice: number;
  purchasePrice?: number;
  vatRate?: number;
  unit: ProductUnit;
}

/**
 * Cas d'utilisation : créer un produit ou un service.
 *
 * Règles :
 *   - SKU fourni : normalisé en MAJUSCULES, unicité vérifiée (409) ;
 *   - SKU absent : auto-généré (PROD-0001, PROD-0002...) à partir d'une
 *     séquence qui ne redescend jamais (count avec les supprimés) ;
 *   - la catégorie, si fournie, doit exister ;
 *   - TVA par défaut : 20 %.
 */
@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(input: CreateProductInput): Promise<Product> {
    if (input.categoryId !== undefined) {
      const category = await this.categoryRepository.findById(
        input.categoryId,
      );
      if (!category) {
        throw new ResourceNotFoundException('La catégorie');
      }
    }

    const sku = await this.resolveSku(input.sku);

    return this.productRepository.create({
      sku,
      name: input.name.trim(),
      description: input.description ?? null,
      type: input.type,
      categoryId: input.categoryId ?? null,
      unitPrice: input.unitPrice,
      purchasePrice: input.purchasePrice ?? null,
      vatRate: input.vatRate ?? 20,
      unit: input.unit,
    });
  }

  /** SKU explicite (normalisé + unicité) ou auto-généré. */
  private async resolveSku(requested: string | undefined): Promise<string> {
    if (requested !== undefined) {
      const sku = requested.trim().toUpperCase();
      const existing = await this.productRepository.findBySku(sku);
      if (existing) {
        throw new ResourceAlreadyExistsException(
          'Un produit avec ce SKU existe déjà.',
        );
      }
      return sku;
    }

    // Auto-génération : PROD- + numéro sur 4 chiffres. La séquence est
    // dérivée du nombre total de produits (supprimés compris) : simple
    // et suffisant ici — deux créations rigoureusement simultanées
    // seraient départagées par l'index UNIQUE de la base.
    const sequence = (await this.productRepository.countAllIncludingDeleted()) + 1;
    return `PROD-${String(sequence).padStart(4, '0')}`;
  }
}
```

### ➕ Créer `src/modules/catalogue/application/update-product.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type { CategoryRepositoryPort } from '../domain/category-repository.port';
import { Product } from '../domain/product';
import { ProductType } from '../domain/product-type.enum';
import { ProductUnit } from '../domain/product-unit.enum';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type {
  ProductRepositoryPort,
  UpdateProductData,
} from '../domain/product-repository.port';

/** Champs modifiables (sémantique PATCH). */
export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string;
  type?: ProductType;
  categoryId?: string;
  unitPrice?: number;
  purchasePrice?: number;
  vatRate?: number;
  unit?: ProductUnit;
  isActive?: boolean;
}

/**
 * Cas d'utilisation : modifier un produit.
 * Si le SKU change : re-vérification d'unicité (en ignorant le produit
 * lui-même). Si la catégorie change : elle doit exister.
 */
@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(
    productId: string,
    input: UpdateProductInput,
  ): Promise<Product> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ResourceNotFoundException('Le produit');
    }

    const changes: UpdateProductData = { ...input };

    if (input.sku !== undefined) {
      const sku = input.sku.trim().toUpperCase();
      const existing = await this.productRepository.findBySku(sku);
      if (existing && existing.id.toLowerCase() !== productId.toLowerCase()) {
        throw new ResourceAlreadyExistsException(
          'Un produit avec ce SKU existe déjà.',
        );
      }
      changes.sku = sku;
    }

    if (input.categoryId !== undefined) {
      const category = await this.categoryRepository.findById(
        input.categoryId,
      );
      if (!category) {
        throw new ResourceNotFoundException('La catégorie');
      }
    }

    if (input.name !== undefined) {
      changes.name = input.name.trim();
    }

    return this.productRepository.update(productId, changes);
  }
}
```

### ➕ Créer `src/modules/catalogue/application/delete-product.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type { ProductRepositoryPort } from '../domain/product-repository.port';

/**
 * Cas d'utilisation : supprimer (logiquement) un produit.
 *
 * Version minimale : la vérification « pas de devis/commandes actifs
 * utilisant ce produit » (hasActiveUsages → 409) sera branchée quand
 * ces modules existeront (05/06). Le soft-delete rend l'erreur
 * réversible en attendant.
 */
@Injectable()
export class DeleteProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(productId: string): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ResourceNotFoundException('Le produit');
    }

    await this.productRepository.softDelete(productId);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 7 — Les DTOs

> Crée le dossier `src/modules/catalogue/presentation/dto/`.

### ➕ Créer `src/modules/catalogue/presentation/dto/list-categories-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query string de GET /categories (liste courte : pas de pagination). */
export class ListCategoriesQueryDto {
  @ApiPropertyOptional({
    description: 'Filtre par statut (true = actives, false = désactivées).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({
    message: 'Le paramètre "isActive" doit valoir true ou false.',
  })
  isActive?: boolean;
}
```

### ➕ Créer `src/modules/catalogue/presentation/dto/create-category.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Corps de POST /categories (ADMIN et MANAGER). */
export class CreateCategoryDto {
  @ApiProperty({ example: 'Matériel informatique' })
  @IsString()
  @MinLength(1, { message: 'Le nom de la catégorie est obligatoire.' })
  @MaxLength(100, {
    message: 'Le nom de la catégorie ne peut pas dépasser 100 caractères.',
  })
  name!: string;

  @ApiPropertyOptional({ example: 'Ordinateurs, écrans, périphériques.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description:
      'Catégorie parente (doit être une catégorie racine : 1 seul ' +
      'niveau de sous-catégories).',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le parentId doit être un UUID valide.',
  })
  parentId?: string;
}
```

### ➕ Créer `src/modules/catalogue/presentation/dto/update-category.dto.ts`

```typescript
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

/** Corps de PATCH /categories/:id — tout optionnel + isActive. */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional({
    description: 'Réactive (true) ou désactive (false) la catégorie.',
  })
  @IsOptional()
  @IsBoolean({ message: 'Le champ "isActive" doit valoir true ou false.' })
  isActive?: boolean;
}
```

### ➕ Créer `src/modules/catalogue/presentation/dto/category-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Category } from '../../domain/category';

/** Représentation publique d'une catégorie (liste plate). */
export class CategoryResponseDto {
  @ApiProperty({ description: 'Identifiant de la catégorie (UUID).' })
  id!: string;

  @ApiProperty({ example: 'Matériel informatique' })
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'null = catégorie racine ; sinon id du parent.',
    nullable: true,
  })
  parentId!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(category: Category): CategoryResponseDto {
    const dto = new CategoryResponseDto();
    dto.id = category.id;
    dto.name = category.name;
    dto.description = category.description;
    dto.parentId = category.parentId;
    dto.isActive = category.isActive;
    dto.createdAt = category.createdAt;
    dto.updatedAt = category.updatedAt;
    return dto;
  }
}
```

### ➕ Créer `src/modules/catalogue/presentation/dto/list-products-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { ProductType } from '../../domain/product-type.enum';

/** Query string de GET /products (hérite de la pagination du socle). */
export class ListProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtre par catégorie.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "categoryId" doit être un UUID valide.',
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filtre par nature (bien physique ou prestation).',
    enum: ProductType,
  })
  @IsOptional()
  @IsEnum(ProductType, {
    message: 'Le paramètre "type" doit valoir PRODUCT ou SERVICE.',
  })
  type?: ProductType;

  @ApiPropertyOptional({
    description: 'Filtre par statut (true = actifs, false = désactivés).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({
    message: 'Le paramètre "isActive" doit valoir true ou false.',
  })
  isActive?: boolean;
}
```

### ➕ Créer `src/modules/catalogue/presentation/dto/create-product.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProductType } from '../../domain/product-type.enum';
import { ProductUnit } from '../../domain/product-unit.enum';

/** Corps de POST /products (ADMIN et MANAGER). */
export class CreateProductDto {
  @ApiPropertyOptional({
    description:
      'Référence unique. Absente : auto-générée (PROD-0001, PROD-0002...).',
    example: 'ECR-DELL-27',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{3,30}$/, {
    message:
      'Le SKU doit faire 3 à 30 caractères (lettres, chiffres, tirets).',
  })
  sku?: string;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  @IsString()
  @MinLength(1, { message: 'Le nom du produit est obligatoire.' })
  @MaxLength(255, {
    message: 'Le nom du produit ne peut pas dépasser 255 caractères.',
  })
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'La description ne peut pas dépasser 2000 caractères.',
  })
  description?: string;

  @ApiProperty({
    description: 'PRODUCT = bien physique (stock) ; SERVICE = prestation.',
    enum: ProductType,
    example: ProductType.Product,
  })
  @IsEnum(ProductType, {
    message: 'Le type doit valoir PRODUCT ou SERVICE.',
  })
  type!: ProductType;

  @ApiPropertyOptional({ description: 'Catégorie de rattachement.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le categoryId doit être un UUID valide.',
  })
  categoryId?: string;

  @ApiProperty({
    description: 'Prix de vente HT en EUR (2 décimales max).',
    example: 349.9,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le prix de vente doit être un nombre (2 décimales max).' },
  )
  @IsPositive({ message: 'Le prix de vente doit être strictement positif.' })
  unitPrice!: number;

  @ApiPropertyOptional({
    description: "Prix d'achat HT en EUR (calcul de marge).",
    example: 220,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Le prix d'achat doit être un nombre (2 décimales max)." },
  )
  @Min(0, { message: "Le prix d'achat ne peut pas être négatif." })
  purchasePrice?: number;

  @ApiPropertyOptional({
    description: 'Taux de TVA en % (taux français en vigueur).',
    default: 20,
    enum: [0, 5.5, 10, 20],
  })
  @IsOptional()
  @IsIn([0, 5.5, 10, 20], {
    message: 'Le taux de TVA doit valoir 0, 5.5, 10 ou 20.',
  })
  vatRate?: number;

  @ApiProperty({ enum: ProductUnit, example: ProductUnit.Unit })
  @IsEnum(ProductUnit, {
    message: "L'unité doit valoir UNIT, KG, LITER, HOUR, DAY ou METER.",
  })
  unit!: ProductUnit;
}
```

### ➕ Créer `src/modules/catalogue/presentation/dto/update-product.dto.ts`

```typescript
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

/** Corps de PATCH /products/:id — tout optionnel + isActive. */
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({
    description: 'Réactive (true) ou désactive (false) le produit.',
  })
  @IsOptional()
  @IsBoolean({ message: 'Le champ "isActive" doit valoir true ou false.' })
  isActive?: boolean;
}
```

### ➕ Créer `src/modules/catalogue/presentation/dto/product-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../../domain/product';
import { ProductType } from '../../domain/product-type.enum';
import { ProductUnit } from '../../domain/product-unit.enum';

/**
 * Représentation publique d'un produit.
 * Version minimale : expose categoryId ; l'objet catégorie complet
 * embarqué (spec §8) arrive au niveau min- avec la jointure.
 */
export class ProductResponseDto {
  @ApiProperty({ description: 'Identifiant du produit (UUID).' })
  id!: string;

  @ApiProperty({ example: 'PROD-0001' })
  sku!: string;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ProductType })
  type!: ProductType;

  @ApiProperty({ nullable: true })
  categoryId!: string | null;

  @ApiProperty({ description: 'Prix de vente HT en EUR.', example: 349.9 })
  unitPrice!: number;

  @ApiProperty({ nullable: true, example: 220 })
  purchasePrice!: number | null;

  @ApiProperty({ example: 20 })
  vatRate!: number;

  @ApiProperty({ enum: ProductUnit })
  unit!: ProductUnit;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.sku = product.sku;
    dto.name = product.name;
    dto.description = product.description;
    dto.type = product.type;
    dto.categoryId = product.categoryId;
    dto.unitPrice = product.unitPrice;
    dto.purchasePrice = product.purchasePrice;
    dto.vatRate = product.vatRate;
    dto.unit = product.unit;
    dto.isActive = product.isActive;
    dto.imageUrl = product.imageUrl;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;
    return dto;
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 8 — Les deux contrôleurs

Un contrôleur par ressource REST : c'est plus lisible que de tout entasser dans un seul fichier, et Swagger y gagne deux sections propres.

### ➕ Créer `src/modules/catalogue/presentation/categories.controller.ts`

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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { CreateCategoryUseCase } from '../application/create-category.use-case';
import { DeleteCategoryUseCase } from '../application/delete-category.use-case';
import { GetCategoryByIdUseCase } from '../application/get-category-by-id.use-case';
import { ListCategoriesUseCase } from '../application/list-categories.use-case';
import { UpdateCategoryUseCase } from '../application/update-category.use-case';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/**
 * Contrôleur des catégories du catalogue.
 * Lecture ouverte à tous les rôles ; écriture ADMIN/MANAGER ;
 * suppression ADMIN.
 */
@ApiTags('Catalogue — Catégories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
    private readonly getCategoryByIdUseCase: GetCategoryByIdUseCase,
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste des catégories (plate, non paginée)',
    description:
      'Renvoie toutes les catégories avec leur parentId : le ' +
      'consommateur reconstitue l’arbre. Filtre optionnel : isActive.',
  })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  async list(
    @Query() query: ListCategoriesQueryDto,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.listCategoriesUseCase.execute({
      isActive: query.isActive,
    });
    return categories.map(CategoryResponseDto.fromDomain);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une catégorie" })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Catégorie inconnue ou supprimée.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CategoryResponseDto> {
    const category = await this.getCategoryByIdUseCase.execute(id);
    return CategoryResponseDto.fromDomain(category);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Créer une catégorie' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiConflictResponse({
    description:
      'Parent déjà sous-catégorie : 1 seul niveau autorisé ' +
      '(BUSINESS_RULE_VIOLATION).',
  })
  async create(
    @Body() body: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.createCategoryUseCase.execute(body);
    return CategoryResponseDto.fromDomain(category);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Modifier une catégorie' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Catégorie inconnue ou supprimée.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.updateCategoryUseCase.execute(id, body);
    return CategoryResponseDto.fromDomain(category);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une catégorie',
    description:
      'Refusé (409) si la catégorie a des sous-catégories ou des ' +
      'produits rattachés.',
  })
  @ApiNoContentResponse({ description: 'Catégorie supprimée.' })
  @ApiConflictResponse({
    description:
      'Sous-catégories ou produits rattachés (BUSINESS_RULE_VIOLATION).',
  })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.deleteCategoryUseCase.execute(id);
  }
}
```

### ➕ Créer `src/modules/catalogue/presentation/products.controller.ts`

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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { CreateProductUseCase } from '../application/create-product.use-case';
import { DeleteProductUseCase } from '../application/delete-product.use-case';
import { GetProductByIdUseCase } from '../application/get-product-by-id.use-case';
import { ListProductsUseCase } from '../application/list-products.use-case';
import { UpdateProductUseCase } from '../application/update-product.use-case';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/**
 * Contrôleur des produits & services du catalogue.
 * Lecture ouverte à tous les rôles ; écriture ADMIN/MANAGER ;
 * suppression ADMIN.
 */
@ApiTags('Catalogue — Produits')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des produits et services',
    description:
      'Filtres : categoryId, type, isActive, search (SKU / nom). ' +
      'La pagination est renvoyée dans meta.pagination.',
  })
  @ApiOkResponse({ type: [ProductResponseDto] })
  async list(
    @Query() query: ListProductsQueryDto,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    const result = await this.listProductsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      categoryId: query.categoryId,
      type: query.type,
      isActive: query.isActive,
    });

    return {
      items: result.items.map(ProductResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un produit" })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Produit inconnu ou supprimé.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductResponseDto> {
    const product = await this.getProductByIdUseCase.execute(id);
    return ProductResponseDto.fromDomain(product);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Créer un produit ou un service',
    description: 'SKU auto-généré (PROD-XXXX) si absent du corps.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiConflictResponse({
    description: 'SKU déjà utilisé (RESOURCE_ALREADY_EXISTS).',
  })
  async create(@Body() body: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.createProductUseCase.execute(body);
    return ProductResponseDto.fromDomain(product);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Modifier un produit' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Produit inconnu ou supprimé.' })
  @ApiConflictResponse({
    description: 'Nouveau SKU déjà utilisé (RESOURCE_ALREADY_EXISTS).',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.updateProductUseCase.execute(id, body);
    return ProductResponseDto.fromDomain(product);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Désactiver un produit (suppression logique)',
    description:
      'Le blocage « produit utilisé dans des devis/commandes actifs » ' +
      'arrivera avec les modules 05/06.',
  })
  @ApiNoContentResponse({ description: 'Produit désactivé.' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.deleteProductUseCase.execute(id);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 9 — Le module + AppModule

### ➕ Créer `src/modules/catalogue/catalogue.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateCategoryUseCase } from './application/create-category.use-case';
import { CreateProductUseCase } from './application/create-product.use-case';
import { DeleteCategoryUseCase } from './application/delete-category.use-case';
import { DeleteProductUseCase } from './application/delete-product.use-case';
import { GetCategoryByIdUseCase } from './application/get-category-by-id.use-case';
import { GetProductByIdUseCase } from './application/get-product-by-id.use-case';
import { ListCategoriesUseCase } from './application/list-categories.use-case';
import { ListProductsUseCase } from './application/list-products.use-case';
import { UpdateCategoryUseCase } from './application/update-category.use-case';
import { UpdateProductUseCase } from './application/update-product.use-case';
import { CATEGORY_REPOSITORY } from './domain/category-repository.port';
import { PRODUCT_REPOSITORY } from './domain/product-repository.port';
import { CategoryMapper } from './infrastructure/category.mapper';
import { CategoryEntity } from './infrastructure/entities/category.entity';
import { ProductEntity } from './infrastructure/entities/product.entity';
import { ProductMapper } from './infrastructure/product.mapper';
import { TypeOrmCategoryRepository } from './infrastructure/typeorm-category.repository';
import { TypeOrmProductRepository } from './infrastructure/typeorm-product.repository';
import { CategoriesController } from './presentation/categories.controller';
import { ProductsController } from './presentation/products.controller';

/**
 * Module du catalogue (catégories + produits/services).
 *
 * PRODUCT_REPOSITORY et GetProductByIdUseCase sont exportés : les
 * modules stocks (04), devis (05) et commandes (06) en auront besoin
 * pour valider leurs lignes de produits.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, ProductEntity])],
  controllers: [CategoriesController, ProductsController],
  providers: [
    CategoryMapper,
    ProductMapper,
    ListCategoriesUseCase,
    GetCategoryByIdUseCase,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
    ListProductsUseCase,
    GetProductByIdUseCase,
    CreateProductUseCase,
    UpdateProductUseCase,
    DeleteProductUseCase,
    {
      provide: CATEGORY_REPOSITORY,
      useClass: TypeOrmCategoryRepository,
    },
    {
      provide: PRODUCT_REPOSITORY,
      useClass: TypeOrmProductRepository,
    },
  ],
  exports: [PRODUCT_REPOSITORY, GetProductByIdUseCase],
})
export class CatalogueModule {}
```

### ✏️ Modifier `src/app.module.ts`

**1)** Ajoute l'import :

```typescript
import { CatalogueModule } from './modules/catalogue/catalogue.module';
```

**2)** Dans le tableau `imports` :

**AVANT** :

```typescript
    UsersModule,
    ContactsModule,
    AuthenticationModule,
```

**APRÈS** :

```typescript
    UsersModule,
    ContactsModule,
    CatalogueModule,
    AuthenticationModule,
```

**✅ Point de contrôle** :

```bash
npm run build
npm run start:dev
```

Les logs listent les 10 routes (`/api/v1/categories*` et `/api/v1/products*`) ; Swagger affiche deux sections « Catalogue — Catégories » et « Catalogue — Produits ».

---

## Étape 10 — Vérifier que ça marche & ce qu'on verra plus tard

### 10.1 Parcours manuel (PowerShell)

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion en ADMIN
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

# 2. Créer une catégorie racine, puis une sous-catégorie
$cat = Invoke-RestMethod -Method Post -Uri "$base/categories" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Matériel informatique"}'
$sousCat = Invoke-RestMethod -Method Post -Uri "$base/categories" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"name":"Écrans","parentId":"' + $cat.data.id + '"}')

# 3. La règle du niveau unique : sous-sous-catégorie → 409
try {
  Invoke-RestMethod -Method Post -Uri "$base/categories" -Headers $headers `
    -ContentType 'application/json' `
    -Body ('{"name":"Trop profond","parentId":"' + $sousCat.data.id + '"}')
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 4. Créer un produit SANS SKU : regarde le PROD-0001 auto-généré
$prod = Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"name":"Écran Dell 27\" QHD","type":"PRODUCT","unit":"UNIT",' +
         '"unitPrice":349.90,"purchasePrice":220,"categoryId":"' + $sousCat.data.id + '"}')
$prod.data.sku          # → PROD-0001
$prod.data.unitPrice    # → 349.9 : un NOMBRE, pas une chaîne (le transformer !)

# 5. Créer un service (pas de stock, TVA 20 par défaut)
Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Installation sur site","type":"SERVICE","unit":"HOUR","unitPrice":85}' |
  Out-Null

# 6. La validation des prix : TVA fantaisiste → 400
try {
  Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
    -ContentType 'application/json' `
    -Body '{"name":"Test","type":"PRODUCT","unit":"UNIT","unitPrice":10,"vatRate":19.6}'
} catch {
  $_.Exception.Response.StatusCode   # attendu : BadRequest (400)
}

# 7. Lister avec filtres (type + recherche + pagination en meta)
Invoke-RestMethod -Uri "$base/products?type=PRODUCT&search=dell" -Headers $headers |
  ConvertTo-Json -Depth 5

# 8. Supprimer la catégorie qui contient un produit → 409, message clair
try {
  Invoke-WebRequest -Method Delete -Uri "$base/categories/$($sousCat.data.id)" `
    -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 9. Supprimer le produit (204), puis la sous-catégorie passe (204)
Invoke-WebRequest -Method Delete -Uri "$base/products/$($prod.data.id)" `
  -Headers $headers | Select-Object StatusCode
Invoke-WebRequest -Method Delete -Uri "$base/categories/$($sousCat.data.id)" `
  -Headers $headers | Select-Object StatusCode
```

Même parcours possible à la souris dans **Swagger**.

### 10.2 Ce qu'on verra plus tard (rien n'est perdu)

| Différé | Pourquoi ce n'est pas bloquant | Niveau |
|---|---|---|
| **Upload d'image** (`POST /products/:id/image`, multipart via StorageModule) | Fonctionnalité de confort ; la colonne `image_url` est DÉJÀ en base, aucune migration à prévoir | 🟡 min- |
| **Objet `category` embarqué** dans la réponse produit (jointure) | `categoryId` + `GET /categories/:id` couvrent le besoin ; la jointure est une optimisation d'affichage | 🟡 min- |
| **`hasActiveUsages`** (blocage de suppression si devis/commandes actifs) | Impossible avant les modules 05/06 ; le soft-delete rend l'erreur réversible | 🟡 min- (après 05/06) |
| **Audit** (`categories.*`, `products.*`) | Traçabilité, pas fonctionnel | 🟡 min- |
| **Tests** (unit : SKU dupliqué/auto, catégorie non vide ; intégration ; e2e cycle complet) | L'application fonctionne ; garantie long terme | 🔴 complet |

### 10.3 Ce que ce module t'a appris de nouveau

1. **Un module à deux entités reliées** : le pattern « colonne FK + relation `@ManyToOne` » (la colonne pour le code, la relation pour la clé étrangère SQL) — tu le reverras dans TOUS les modules suivants.
2. **Le self-join** : une table qui se référence elle-même pour une hiérarchie.
3. **`decimal(12,2)` + transformer** : l'argent ne se stocke JAMAIS en float, et le driver renvoie les decimal en chaîne — le `DecimalColumnTransformer` de `src/common/database/` règle ça pour tous les modules d'argent à venir (05 à 08).
4. **Une liste non paginée assumée** (catégories) : la pagination est un outil, pas un réflexe.
5. **La génération de référence** (SKU auto avec séquence qui ne redescend jamais) — le même principe servira aux numéros de devis (`DEV-2026-0001`) et de factures.
6. **Traduire une contrainte SQL en message métier** : la clé étrangère protège les données, mais c'est le use case (`hasProducts` → 409) qui protège l'utilisateur d'un 500 incompréhensible.

---

*Fin du guide mini-DEV-03. Prochain module : la gestion des stocks (04) — multi-entrepôts, mouvements comme source de vérité, et première transaction SQL (le transfert entre entrepôts).*

