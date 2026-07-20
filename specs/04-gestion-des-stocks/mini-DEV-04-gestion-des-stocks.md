# mini-DEV-04 · Gestion des Stocks — l'essentiel pour démarrer

> **Spec couverte** : `specs/04-gestion-des-stocks/04-gestion-des-stocks.md` (version minimale)
> **Niveau** : 🟢 fonctionnel — même logique que les `mini-DEV-01/02/03` (voir `RECAP-DEV-01` pour la philosophie des 3 niveaux).
> **Prérequis** : `mini-DEV-01` (rôles, `@Roles()`, exceptions) ET `mini-DEV-03` (le stock porte sur les produits du catalogue — sans table `products`, rien ne compile). Le module 02 n'est pas nécessaire.
> **Promesse** : à la fin, une gestion de stock multi-entrepôts où **les mouvements sont la source de vérité** : entrées, sorties, transferts atomiques entre entrepôts, ajustements d'inventaire tracés — et un stock qui ne peut JAMAIS passer en négatif, même en cas d'accès concurrents. 11 routes dans Swagger. Environ 4 h.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — Le domaine : les entrepôts](#étape-1--le-domaine--les-entrepôts)
- [Étape 2 — Le domaine : niveaux, mouvements et écrivain atomique](#étape-2--le-domaine--niveaux-mouvements-et-écrivain-atomique)
- [Étape 3 — Les entités TypeORM et les mappers](#étape-3--les-entités-typeorm-et-les-mappers)
- [Étape 4 — La migration](#étape-4--la-migration)
- [Étape 5 — Les repositories + le writer transactionnel](#étape-5--les-repositories--le-writer-transactionnel)
- [Étape 6 — Les cas d'utilisation : entrepôts (5)](#étape-6--les-cas-dutilisation--entrepôts-5)
- [Étape 7 — Les cas d'utilisation : stock (6)](#étape-7--les-cas-dutilisation--stock-6)
- [Étape 8 — Les DTOs](#étape-8--les-dtos)
- [Étape 9 — Les deux contrôleurs](#étape-9--les-deux-contrôleurs)
- [Étape 10 — Le module + AppModule](#étape-10--le-module--appmodule)
- [Étape 11 — Vérifier que ça marche & ce qu'on verra plus tard](#étape-11--vérifier-que-ça-marche--ce-quon-verra-plus-tard)

---

## 0 · Avant de commencer

- API démarrée (`npm run start:dev`), base à jour (`npm run migration:run`), `admin@local.dev` en ADMIN, tables `products`/`categories` présentes (module 03 appliqué).
- Pour les rappels sur le socle (architecture, enveloppe, exceptions, pagination) : section A de `mini-DEV-01`.

### Les nouveautés de ce module

C'est le module le plus riche jusqu'ici — quatre concepts nouveaux, tous réutilisés dans les modules 05 à 08 :

1. **La transaction SQL.** Le transfert entre entrepôts écrit 2 mouvements + 2 niveaux de stock : soit TOUT réussit, soit TOUT est annulé. On découvre le `TransactionService` du socle — et on l'applique en fait à *toutes* les écritures de stock (un mouvement et son niveau ne doivent jamais diverger).
2. **La clé primaire composite.** Un niveau de stock est identifié par le COUPLE (produit, entrepôt) — pas de colonne `id`. Première entité qui n'hérite pas d'`AuditableEntity`.
3. **La contrainte `CHECK` en base.** `quantity >= 0` est vérifié par le use case ET par SQL Server : si deux sorties simultanées « croisent » la vérification applicative, la base refuse la seconde. Ceinture et bretelles.
4. **Le read model (vue enrichie).** L'écran de stock a besoin des NOMS de produit et d'entrepôt, pas seulement des UUID : le repository renvoie une « vue » jointe, distincte du modèle de domaine.

Et une philosophie à retenir : **un mouvement de stock ne se modifie jamais** (entité immuable, comme les audit logs). Une erreur se corrige par un mouvement inverse ou un ajustement — exactement comme une écriture comptable.

**Choix assumé de cette version** : les quantités sont des **entiers** (`int`). Suffisant pour des articles vendus à la pièce — la grande majorité des cas. Les quantités décimales (kg, litres) exigent une arithmétique décimale soignée : différées (voir § final).

---

## B · Ce qu'on va construire

**Côté entrepôts (`/warehouses`)** — liste courte, non paginée (une entreprise a rarement plus de quelques entrepôts) :

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/warehouses` | tout connecté | Liste (filtre `isActive`) |
| `GET /api/v1/warehouses/:id` | tout connecté | Détail |
| `POST /api/v1/warehouses` | ADMIN | Créer (code unique, normalisé MAJUSCULES) |
| `PATCH /api/v1/warehouses/:id` | ADMIN, MANAGER | Modifier / réactiver |
| `DELETE /api/v1/warehouses/:id` | ADMIN | Désactiver — refusé (409) si du stock reste dedans |

**Côté stock (`/stock`)** :

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/stock` | tout connecté | Niveaux paginés, **enrichis** (nom produit/entrepôt) ; filtres `productId`, `warehouseId`, `lowStock`, `search` |
| `GET /api/v1/stock/movements` | ADMIN, MANAGER | Historique paginé des mouvements ; filtres `productId`, `warehouseId`, `type`, `from`, `to` |
| `POST /api/v1/stock/in` | tout connecté | Entrée (réception, achat) |
| `POST /api/v1/stock/out` | tout connecté | Sortie (vente, consommation) |
| `POST /api/v1/stock/transfer` | ADMIN, MANAGER | Transfert entre entrepôts (**transaction**) |
| `POST /api/v1/stock/adjust` | ADMIN, MANAGER | Ajustement d'inventaire (`notes` obligatoires) |

**Les règles métier incluses** :

- quantité toujours strictement positive dans les DTOs (la *direction* est portée par le type de mouvement) ;
- stock négatif impossible : vérification en use case + contrainte `CHECK` en base ;
- les SERVICES n'ont pas de stock : tout mouvement sur un article `SERVICE` est refusé (409) ;
- transfert atomique : les deux mouvements et les deux niveaux réussissent ou échouent ENSEMBLE ;
- `notes` obligatoires pour un ajustement (traçabilité d'inventaire) — et l'écart réel (`stock : 10 → 7`) y est ajouté automatiquement ;
- un entrepôt ne se désactive que VIDE ; un mouvement n'implique que des entrepôts actifs.

**45 fichiers créés, 1 modifié** (`app.module.ts`), **1 migration générée**. Le module importe `CatalogueModule` (validation des produits) et `DatabaseModule` (transactions) — aucun fichier des modules précédents n'est touché.

**Différé** (détail à l'étape 11) : `GET /stock/:productId` (redondant avec `?productId=`), les noms produit/entrepôt dans l'historique des mouvements, les quantités décimales, l'audit, les tests.

---

## Étape 1 — Le domaine : les entrepôts

> Crée l'arborescence `src/modules/stock/domain/`.

### ➕ Créer `src/modules/stock/domain/warehouse.ts`

```typescript
/**
 * Entrepôt de stockage.
 *
 * Particularité : un entrepôt ne se SUPPRIME jamais (ses mouvements
 * historiques doivent rester lisibles) — il se DÉSACTIVE, et seulement
 * s'il est vide. Pas de deletedAt dans le modèle : isActive suffit.
 */
export class Warehouse {
  constructor(
    public readonly id: string,
    public readonly name: string,
    /** Code court unique, normalisé en MAJUSCULES (ex. : WH-PARIS). */
    public readonly code: string,
    public readonly street: string | null,
    public readonly city: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
```

### ➕ Créer `src/modules/stock/domain/warehouse-repository.port.ts`

```typescript
import { Warehouse } from './warehouse';

/** Filtres de listing (liste courte : pas de pagination). */
export interface ListWarehousesFilters {
  isActive?: boolean;
}

/** Données de création (code déjà normalisé par l'appelant). */
export interface CreateWarehouseData {
  name: string;
  code: string;
  street: string | null;
  city: string | null;
}

/** Champs modifiables d'un entrepôt. */
export interface UpdateWarehouseData {
  name?: string;
  code?: string;
  street?: string;
  city?: string;
  isActive?: boolean;
}

/** Contrat de persistance des entrepôts. */
export interface WarehouseRepositoryPort {
  findAll(filters: ListWarehousesFilters): Promise<Warehouse[]>;
  findById(id: string): Promise<Warehouse | null>;
  /** Recherche par code (déjà normalisé en MAJUSCULES). */
  findByCode(code: string): Promise<Warehouse | null>;
  create(data: CreateWarehouseData): Promise<Warehouse>;
  update(id: string, data: UpdateWarehouseData): Promise<Warehouse>;
  /** Désactivation (is_active = false) — jamais de suppression. */
  deactivate(id: string): Promise<void>;
}

/** Jeton d'injection du repository entrepôts. */
export const WAREHOUSE_REPOSITORY = Symbol('WAREHOUSE_REPOSITORY');
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 2 — Le domaine : niveaux, mouvements et écrivain atomique

### ➕ Créer `src/modules/stock/domain/stock-level.ts`

```typescript
/**
 * Niveau de stock d'un produit dans un entrepôt.
 *
 * Identité = le COUPLE (productId, warehouseId) : il n'y a pas d'id
 * propre. Le niveau n'est jamais écrit directement par un utilisateur :
 * il est recalculé à chaque mouvement (les mouvements sont la source
 * de vérité, le niveau est un état dérivé maintenu en temps réel).
 */
export class StockLevel {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string,
    /** Jamais négatif (vérifié en use case ET par la base). */
    public readonly quantity: number,
    public readonly updatedAt: Date,
  ) {}
}

/**
 * Vue ENRICHIE d'un niveau de stock, pour l'affichage : les écrans de
 * stock ont besoin des noms, pas des UUID.
 *
 * C'est un « read model » : une simple forme de données produite par
 * une jointure SQL, sans comportement — à distinguer du modèle de
 * domaine StockLevel ci-dessus, utilisé pour les calculs.
 */
export interface StockLevelView {
  productId: string;
  productSku: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  updatedAt: Date;
}
```

### ➕ Créer `src/modules/stock/domain/stock-level-repository.port.ts`

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { StockLevel, StockLevelView } from './stock-level';

/** Seuil en dessous duquel un stock est considéré « bas ». */
export const LOW_STOCK_THRESHOLD = 5;

/** Critères de listing des niveaux de stock. */
export interface ListStockLevelsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur SKU et nom du produit. */
  search?: string;
  productId?: string;
  warehouseId?: string;
  /** true = uniquement les stocks < LOW_STOCK_THRESHOLD. */
  lowStock?: boolean;
}

/**
 * Contrat de LECTURE des niveaux de stock.
 * Les écritures passent exclusivement par StockWriterPort (elles sont
 * indissociables d'un mouvement, dans la même transaction).
 */
export interface StockLevelRepositoryPort {
  /** Liste paginée et enrichie (jointures produit + entrepôt). */
  findAllViews(
    query: ListStockLevelsQuery,
  ): Promise<PaginatedResult<StockLevelView>>;

  /** Niveau d'un produit dans un entrepôt ; null si jamais mouvementé. */
  findOne(productId: string, warehouseId: string): Promise<StockLevel | null>;

  /** Somme des quantités d'un entrepôt (0 si aucun niveau). */
  sumQuantityForWarehouse(warehouseId: string): Promise<number>;
}

/** Jeton d'injection du repository des niveaux de stock. */
export const STOCK_LEVEL_REPOSITORY = Symbol('STOCK_LEVEL_REPOSITORY');
```

### ➕ Créer `src/modules/stock/domain/stock-movement-type.enum.ts`

```typescript
/**
 * Nature d'un mouvement de stock. La quantité d'un mouvement est
 * TOUJOURS positive : c'est le type qui porte la direction.
 */
export enum StockMovementType {
  /** Entrée : réception, achat (ou arrivée d'un transfert). */
  In = 'IN',
  /** Sortie : vente, consommation. */
  Out = 'OUT',
  /** Correction d'inventaire (écart constaté au comptage). */
  Adjustment = 'ADJUSTMENT',
  /** Départ d'un transfert inter-entrepôts (côté source). */
  Transfer = 'TRANSFER',
}
```

### ➕ Créer `src/modules/stock/domain/stock-movement.ts`

```typescript
import { StockMovementType } from './stock-movement-type.enum';

/**
 * Mouvement de stock — la SOURCE DE VÉRITÉ du module.
 *
 * IMMUABLE : un mouvement ne se modifie ni ne se supprime jamais.
 * Une erreur se corrige par un mouvement inverse ou un ajustement,
 * exactement comme une écriture comptable. C'est ce qui rend
 * l'historique digne de confiance.
 */
export class StockMovement {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    /** Entrepôt concerné (source dans le cas d'un transfert). */
    public readonly warehouseId: string,
    /** Entrepôt de destination — uniquement pour un TRANSFER. */
    public readonly targetWarehouseId: string | null,
    public readonly type: StockMovementType,
    /** Toujours positive : la direction est portée par le type. */
    public readonly quantity: number,
    /** Coût unitaire HT en EUR (entrées sur achat), si connu. */
    public readonly unitCost: number | null,
    /** Référence externe libre (ex. : numéro de commande fournisseur). */
    public readonly reference: string | null,
    public readonly notes: string | null,
    /** UUID de l'utilisateur qui a enregistré le mouvement. */
    public readonly performedBy: string,
    public readonly performedAt: Date,
    public readonly createdAt: Date,
  ) {}
}
```

### ➕ Créer `src/modules/stock/domain/stock-movement-repository.port.ts`

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { StockMovement } from './stock-movement';
import { StockMovementType } from './stock-movement-type.enum';

/** Critères de listing de l'historique des mouvements. */
export interface ListStockMovementsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur reference et notes. */
  search?: string;
  productId?: string;
  warehouseId?: string;
  type?: StockMovementType;
  /** Bornes sur performedAt (incluses). */
  from?: Date;
  to?: Date;
}

/**
 * Contrat de LECTURE des mouvements. La création passe par
 * StockWriterPort (un mouvement s'écrit toujours AVEC son niveau).
 */
export interface StockMovementRepositoryPort {
  findAll(
    query: ListStockMovementsQuery,
  ): Promise<PaginatedResult<StockMovement>>;
}

/** Jeton d'injection du repository des mouvements. */
export const STOCK_MOVEMENT_REPOSITORY = Symbol('STOCK_MOVEMENT_REPOSITORY');
```

### ➕ Créer `src/modules/stock/domain/stock-writer.port.ts`

Le cœur du module. Chaque écriture de stock = **un ou plusieurs mouvements + les niveaux résultants**, indissociables : si l'un échoue, tout doit être annulé. Ce port exprime ce contrat ; l'implémentation (étape 5) utilisera une transaction SQL. Remarque : le port ne mentionne NI TypeORM ni transaction — c'est un détail d'infrastructure, le domaine dit seulement « atomique ».

```typescript
import { StockMovement } from './stock-movement';
import { StockMovementType } from './stock-movement-type.enum';

/** Données d'un mouvement à enregistrer. */
export interface NewStockMovementData {
  productId: string;
  warehouseId: string;
  targetWarehouseId: string | null;
  type: StockMovementType;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  notes: string | null;
  performedBy: string;
  performedAt: Date;
}

/**
 * Niveau RÉSULTANT à écrire : la quantité est la nouvelle valeur
 * absolue (déjà calculée par le use case), pas un delta.
 */
export interface StockLevelWrite {
  productId: string;
  warehouseId: string;
  quantity: number;
}

/**
 * Contrat d'écriture ATOMIQUE du stock : les mouvements et les niveaux
 * fournis sont persistés ensemble — tout réussit ou tout est annulé.
 * Renvoie les mouvements créés, dans l'ordre fourni.
 */
export interface StockWriterPort {
  write(
    movements: NewStockMovementData[],
    levels: StockLevelWrite[],
  ): Promise<StockMovement[]>;
}

/** Jeton d'injection de l'écrivain de stock. */
export const STOCK_WRITER = Symbol('STOCK_WRITER');
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 3 — Les entités TypeORM et les mappers

> Crée l'arborescence `src/modules/stock/infrastructure/entities/`.

### ➕ Créer `src/modules/stock/infrastructure/entities/warehouse.entity.ts`

```typescript
import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';

/**
 * Entité TypeORM de la table `warehouses`.
 *
 * Hérite d'AuditableEntity par cohérence avec le reste du projet, mais
 * la colonne deleted_at restera toujours NULL : un entrepôt se
 * DÉSACTIVE (is_active = false), il ne se supprime jamais — ses
 * mouvements historiques doivent rester lisibles.
 */
@Entity({ name: 'warehouses' })
export class WarehouseEntity extends AuditableEntity {
  @Index('IX_warehouses_name')
  @Column({ name: 'name', type: 'nvarchar', length: 100 })
  name!: string;

  /** Code court unique, normalisé en MAJUSCULES par la couche application. */
  @Index('UQ_warehouses_code', { unique: true })
  @Column({ name: 'code', type: 'nvarchar', length: 20 })
  code!: string;

  @Column({ name: 'street', type: 'nvarchar', length: 255, nullable: true })
  street!: string | null;

  @Column({ name: 'city', type: 'nvarchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;
}
```

### ➕ Créer `src/modules/stock/infrastructure/entities/stock-level.entity.ts`

**Première entité à clé primaire composite** : pas de colonne `id`, l'identité est le couple (produit, entrepôt) — il ne peut donc y avoir qu'UNE ligne par couple, c'est le schéma qui le garantit. Conséquence : elle ne peut pas hériter d'`AuditableEntity` (qui impose un id UUID) ; on déclare ses colonnes à la main.

```typescript
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductEntity } from '../../../catalogue/infrastructure/entities/product.entity';
import { WarehouseEntity } from './warehouse.entity';

/**
 * Entité TypeORM de la table `stock_levels`.
 *
 * Clé primaire COMPOSITE (product_id, warehouse_id) : deux
 * @PrimaryColumn. La contrainte CHECK interdit tout stock négatif AU
 * NIVEAU SQL : même si deux transactions concurrentes « croisent » la
 * vérification applicative, la base refuse la seconde écriture.
 */
@Entity({ name: 'stock_levels' })
@Check('CHK_stock_levels_quantity', '"quantity" >= 0')
export class StockLevelEntity {
  @PrimaryColumn({ name: 'product_id', type: 'uniqueidentifier' })
  productId!: string;

  @PrimaryColumn({ name: 'warehouse_id', type: 'uniqueidentifier' })
  warehouseId!: string;

  /** Index : les requêtes « low stock » filtrent sur cette colonne. */
  @Index('IX_stock_levels_quantity')
  @Column({ name: 'quantity', type: 'int', default: 0 })
  quantity!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
  updatedAt!: Date;

  /** Relations : clés étrangères SQL + jointures des vues enrichies. */
  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity;

  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: WarehouseEntity;
}
```

### ➕ Créer `src/modules/stock/infrastructure/entities/stock-movement.entity.ts`

Un mouvement ne se modifie jamais → base `ImmutableEntity` (comme les audit logs) : id + created_at, ni updated_at ni deleted_at.

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { ImmutableEntity } from '../../../../common/entities/immutable.entity';
import { ProductEntity } from '../../../catalogue/infrastructure/entities/product.entity';
import { StockMovementType } from '../../domain/stock-movement-type.enum';
import { WarehouseEntity } from './warehouse.entity';

/**
 * Entité TypeORM de la table `stock_movements` (journal immuable).
 *
 * Quatre index : l'historique se filtre par produit, entrepôt, type et
 * période — chacun a son index.
 */
@Entity({ name: 'stock_movements' })
export class StockMovementEntity extends ImmutableEntity {
  @Index('IX_stock_movements_product')
  @Column({ name: 'product_id', type: 'uniqueidentifier' })
  productId!: string;

  @Index('IX_stock_movements_warehouse')
  @Column({ name: 'warehouse_id', type: 'uniqueidentifier' })
  warehouseId!: string;

  /** Renseigné uniquement pour un TRANSFER (entrepôt de destination). */
  @Column({
    name: 'target_warehouse_id',
    type: 'uniqueidentifier',
    nullable: true,
  })
  targetWarehouseId!: string | null;

  @Index('IX_stock_movements_type')
  @Column({ name: 'type', type: 'nvarchar', length: 12 })
  type!: StockMovementType;

  /** Toujours positive : la direction est portée par le type. */
  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  /** Coût unitaire HT en EUR : de l'argent → decimal + transformer. */
  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: new DecimalColumnTransformer(),
  })
  unitCost!: number | null;

  @Column({ name: 'reference', type: 'nvarchar', length: 50, nullable: true })
  reference!: string | null;

  @Column({ name: 'notes', type: 'nvarchar', length: 500, nullable: true })
  notes!: string | null;

  /**
   * UUID de l'utilisateur — simple colonne, PAS de relation vers users
   * (même choix qu'AuditableEntity.createdBy : pas de couplage).
   */
  @Column({ name: 'performed_by', type: 'uniqueidentifier' })
  performedBy!: string;

  @Index('IX_stock_movements_performed_at')
  @Column({ name: 'performed_at', type: 'datetime2' })
  performedAt!: Date;

  /** Relations : clés étrangères SQL (le code n'utilise que les ids). */
  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity;

  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: WarehouseEntity;

  @ManyToOne(() => WarehouseEntity, { nullable: true })
  @JoinColumn({ name: 'target_warehouse_id' })
  targetWarehouse?: WarehouseEntity | null;
}
```

### ➕ Créer `src/modules/stock/infrastructure/warehouse.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Warehouse } from '../domain/warehouse';
import { WarehouseEntity } from './entities/warehouse.entity';

/** Conversion entité TypeORM <-> modèle de domaine. */
@Injectable()
export class WarehouseMapper {
  toDomain(entity: WarehouseEntity): Warehouse {
    return new Warehouse(
      entity.id,
      entity.name,
      entity.code,
      entity.street,
      entity.city,
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
    );
  }
}
```

### ➕ Créer `src/modules/stock/infrastructure/stock-level.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { StockLevel, StockLevelView } from '../domain/stock-level';
import { ProductEntity } from '../../catalogue/infrastructure/entities/product.entity';
import { StockLevelEntity } from './entities/stock-level.entity';
import { WarehouseEntity } from './entities/warehouse.entity';

/** Conversion entité TypeORM -> modèle de domaine / vue enrichie. */
@Injectable()
export class StockLevelMapper {
  toDomain(entity: StockLevelEntity): StockLevel {
    return new StockLevel(
      entity.productId,
      entity.warehouseId,
      entity.quantity,
      entity.updatedAt,
    );
  }

  /**
   * Vue enrichie : EXIGE que les relations product et warehouse aient
   * été chargées (innerJoinAndSelect dans le repository) — sinon les
   * casts ci-dessous mentiraient.
   */
  toView(entity: StockLevelEntity): StockLevelView {
    const product = entity.product as ProductEntity;
    const warehouse = entity.warehouse as WarehouseEntity;
    return {
      productId: entity.productId,
      productSku: product.sku,
      productName: product.name,
      warehouseId: entity.warehouseId,
      warehouseName: warehouse.name,
      quantity: entity.quantity,
      updatedAt: entity.updatedAt,
    };
  }
}
```

### ➕ Créer `src/modules/stock/infrastructure/stock-movement.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { StockMovement } from '../domain/stock-movement';
import { StockMovementEntity } from './entities/stock-movement.entity';

/** Conversion entité TypeORM -> modèle de domaine. */
@Injectable()
export class StockMovementMapper {
  toDomain(entity: StockMovementEntity): StockMovement {
    return new StockMovement(
      entity.id,
      entity.productId,
      entity.warehouseId,
      entity.targetWarehouseId,
      entity.type,
      entity.quantity,
      entity.unitCost,
      entity.reference,
      entity.notes,
      entity.performedBy,
      entity.performedAt,
      entity.createdAt,
    );
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 4 — La migration

Trois nouvelles tables → migration **générée** :

```bash
npm run migration:generate -- src/database/migrations/CreateStockTables
```

**Relis le fichier généré** avant d'exécuter. Tu dois y trouver :

- `CREATE TABLE "warehouses"` avec `UQ_warehouses_code` (**unique**) et `is_active DEFAULT 1` ;
- `CREATE TABLE "stock_levels"` avec une **clé primaire sur DEUX colonnes** (`PRIMARY KEY ("product_id", "warehouse_id")`) — c'est la traduction des deux `@PrimaryColumn` ;
- la contrainte **`CHECK ("quantity" >= 0)`** (`CHK_stock_levels_quantity`) et `quantity DEFAULT 0` ;
- `CREATE TABLE "stock_movements"` avec les 4 index (`product`, `warehouse`, `type`, `performed_at`) ;
- **cinq `FOREIGN KEY`** : `stock_levels` → `products` et `warehouses` ; `stock_movements` → `products`, `warehouses` (source) et `warehouses` (cible) ;
- un `down()` qui défait tout dans l'ordre inverse ;
- RIEN sur les tables existantes (`users`, `products`, `categories`…).

Puis :

```bash
npm run migration:run
npm run migration:show   # CreateStockTables cochée [X]
```

**✅ Point de contrôle** : la table `stock_levels` existe, sa clé primaire porte sur deux colonnes et sa contrainte CHECK apparaît dans ton client SQL (section « Constraints »).

---

## Étape 5 — Les repositories + le writer transactionnel

### ➕ Créer `src/modules/stock/infrastructure/typeorm-warehouse.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Warehouse } from '../domain/warehouse';
import {
  CreateWarehouseData,
  ListWarehousesFilters,
  UpdateWarehouseData,
  WarehouseRepositoryPort,
} from '../domain/warehouse-repository.port';
import { WarehouseEntity } from './entities/warehouse.entity';
import { WarehouseMapper } from './warehouse.mapper';

/**
 * Implémentation TypeORM du repository entrepôts.
 * Volume faible : l'API simple repository.find() suffit.
 */
@Injectable()
export class TypeOrmWarehouseRepository implements WarehouseRepositoryPort {
  constructor(
    @InjectRepository(WarehouseEntity)
    private readonly repository: Repository<WarehouseEntity>,
    private readonly mapper: WarehouseMapper,
  ) {}

  async findAll(filters: ListWarehousesFilters): Promise<Warehouse[]> {
    const where: FindOptionsWhere<WarehouseEntity> = {};
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const entities = await this.repository.find({
      where,
      order: { name: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findById(id: string): Promise<Warehouse | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByCode(code: string): Promise<Warehouse | null> {
    const entity = await this.repository.findOne({ where: { code } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async create(data: CreateWarehouseData): Promise<Warehouse> {
    const entity = await this.repository.save(
      this.repository.create({ ...data, isActive: true }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateWarehouseData): Promise<Warehouse> {
    // undefined = « non fourni » : seuls les champs présents sont écrits.
    const changes: Partial<WarehouseEntity> = {};
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
    return this.mapper.toDomain(entity as WarehouseEntity);
  }

  async deactivate(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: false });
  }
}
```

### ➕ Créer `src/modules/stock/infrastructure/typeorm-stock-level.repository.ts`

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
import { StockLevel, StockLevelView } from '../domain/stock-level';
import {
  ListStockLevelsQuery,
  LOW_STOCK_THRESHOLD,
  StockLevelRepositoryPort,
} from '../domain/stock-level-repository.port';
import { StockLevelEntity } from './entities/stock-level.entity';
import { StockLevelMapper } from './stock-level.mapper';

/** Liste blanche de tri — inclut des colonnes des tables JOINTES. */
const STOCK_LEVEL_SORTABLE_COLUMNS: ColumnWhitelist = {
  quantity: 'level.quantity',
  productName: 'product.name',
  warehouseName: 'warehouse.name',
  updatedAt: 'level.updatedAt',
};

/** Recherche textuelle : sur le produit joint (SKU et nom). */
const STOCK_LEVEL_SEARCHABLE_COLUMNS = ['product.sku', 'product.name'] as const;

/** Implémentation TypeORM de la lecture des niveaux de stock. */
@Injectable()
export class TypeOrmStockLevelRepository implements StockLevelRepositoryPort {
  constructor(
    @InjectRepository(StockLevelEntity)
    private readonly repository: Repository<StockLevelEntity>,
    private readonly mapper: StockLevelMapper,
  ) {}

  async findAllViews(
    query: ListStockLevelsQuery,
  ): Promise<PaginatedResult<StockLevelView>> {
    // innerJoinAndSelect : charge les relations EN MÊME TEMPS que les
    // niveaux (une seule requête SQL) — indispensable pour toView().
    const queryBuilder = this.repository
      .createQueryBuilder('level')
      .innerJoinAndSelect('level.product', 'product')
      .innerJoinAndSelect('level.warehouse', 'warehouse');

    if (query.productId !== undefined) {
      queryBuilder.andWhere('level.productId = :productId', {
        productId: query.productId,
      });
    }
    if (query.warehouseId !== undefined) {
      queryBuilder.andWhere('level.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.lowStock === true) {
      queryBuilder.andWhere('level.quantity < :threshold', {
        threshold: LOW_STOCK_THRESHOLD,
      });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      STOCK_LEVEL_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('product.name', SortDirection.Asc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        STOCK_LEVEL_SORTABLE_COLUMNS,
      );
    }

    const result = await TypeOrmPaginationHelper.paginate(
      queryBuilder,
      query.page,
      query.limit,
    );

    return {
      items: result.items.map((entity) => this.mapper.toView(entity)),
      meta: result.meta,
    };
  }

  async findOne(
    productId: string,
    warehouseId: string,
  ): Promise<StockLevel | null> {
    const entity = await this.repository.findOne({
      where: { productId, warehouseId },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async sumQuantityForWarehouse(warehouseId: string): Promise<number> {
    const raw = await this.repository
      .createQueryBuilder('level')
      .select('COALESCE(SUM(level.quantity), 0)', 'total')
      .where('level.warehouseId = :warehouseId', { warehouseId })
      .getRawOne<{ total: number | string }>();

    // Les agrégats SQL arrivent parfois en CHAÎNE côté JS : Number().
    return Number(raw?.total ?? 0);
  }
}
```

### ➕ Créer `src/modules/stock/infrastructure/typeorm-stock-movement.repository.ts`

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
import { StockMovement } from '../domain/stock-movement';
import {
  ListStockMovementsQuery,
  StockMovementRepositoryPort,
} from '../domain/stock-movement-repository.port';
import { StockMovementEntity } from './entities/stock-movement.entity';
import { StockMovementMapper } from './stock-movement.mapper';

/** Liste blanche de tri de l'historique. */
const MOVEMENT_SORTABLE_COLUMNS: ColumnWhitelist = {
  performedAt: 'movement.performedAt',
  type: 'movement.type',
  quantity: 'movement.quantity',
};

/** Recherche textuelle sur la référence et les notes. */
const MOVEMENT_SEARCHABLE_COLUMNS = [
  'movement.reference',
  'movement.notes',
] as const;

/** Implémentation TypeORM de la lecture de l'historique des mouvements. */
@Injectable()
export class TypeOrmStockMovementRepository
  implements StockMovementRepositoryPort
{
  constructor(
    @InjectRepository(StockMovementEntity)
    private readonly repository: Repository<StockMovementEntity>,
    private readonly mapper: StockMovementMapper,
  ) {}

  async findAll(
    query: ListStockMovementsQuery,
  ): Promise<PaginatedResult<StockMovement>> {
    const queryBuilder = this.repository.createQueryBuilder('movement');

    if (query.productId !== undefined) {
      queryBuilder.andWhere('movement.productId = :productId', {
        productId: query.productId,
      });
    }
    if (query.warehouseId !== undefined) {
      queryBuilder.andWhere('movement.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.type !== undefined) {
      queryBuilder.andWhere('movement.type = :type', { type: query.type });
    }
    if (query.from !== undefined) {
      queryBuilder.andWhere('movement.performedAt >= :from', {
        from: query.from,
      });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('movement.performedAt <= :to', { to: query.to });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      MOVEMENT_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      // Historique : les mouvements les plus récents d'abord.
      queryBuilder.orderBy('movement.performedAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        MOVEMENT_SORTABLE_COLUMNS,
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
}
```

### ➕ Créer `src/modules/stock/infrastructure/transactional-stock-writer.ts`

**LA nouveauté du module.** Le `TransactionService` du socle ouvre une transaction SQL et nous confie un `EntityManager` : tout ce qui passe par ce manager fait partie de la transaction ; à la moindre exception, TypeORM annule tout (rollback).

```typescript
import { Injectable } from '@nestjs/common';
import { TransactionService } from '../../../database/transaction/transaction.service';
import { StockMovement } from '../domain/stock-movement';
import {
  NewStockMovementData,
  StockLevelWrite,
  StockWriterPort,
} from '../domain/stock-writer.port';
import { StockLevelEntity } from './entities/stock-level.entity';
import { StockMovementEntity } from './entities/stock-movement.entity';
import { StockMovementMapper } from './stock-movement.mapper';

/**
 * Écrivain de stock transactionnel.
 *
 * Chaque appel = UNE transaction SQL : les niveaux puis les mouvements
 * sont écrits ensemble, ou pas du tout. C'est ce qui garantit que
 * l'historique (mouvements) et l'état courant (niveaux) ne divergent
 * jamais — y compris pour le transfert (2 mouvements + 2 niveaux).
 *
 * ⚠️ Règle d'or : TOUTES les écritures passent par le manager reçu
 * (manager.getRepository). Utiliser this.xxxRepository ici ferait
 * sortir l'opération de la transaction en silence.
 */
@Injectable()
export class TransactionalStockWriter implements StockWriterPort {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly mapper: StockMovementMapper,
  ) {}

  async write(
    movements: NewStockMovementData[],
    levels: StockLevelWrite[],
  ): Promise<StockMovement[]> {
    return this.transactionService.execute(async (manager) => {
      const levelRepository = manager.getRepository(StockLevelEntity);
      const movementRepository = manager.getRepository(StockMovementEntity);

      // save() sur une entité à clé primaire composite = UPSERT :
      // INSERT si le couple (product_id, warehouse_id) est inconnu,
      // UPDATE sinon. Exactement la sémantique voulue pour un niveau.
      // Si une quantité négative arrivait ici malgré les vérifications
      // des use cases (accès concurrents), la contrainte CHECK ferait
      // échouer la transaction : rollback, jamais de stock négatif.
      await levelRepository.save(
        levels.map((level) => levelRepository.create(level)),
      );

      const saved = await movementRepository.save(
        movements.map((movement) => movementRepository.create(movement)),
      );

      return saved.map((entity) => this.mapper.toDomain(entity));
    });
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 6 — Les cas d'utilisation : entrepôts (5)

> Crée le dossier `src/modules/stock/application/`.

### ➕ Créer `src/modules/stock/application/list-warehouses.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Warehouse } from '../domain/warehouse';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type {
  ListWarehousesFilters,
  WarehouseRepositoryPort,
} from '../domain/warehouse-repository.port';

/** Cas d'utilisation : lister les entrepôts (liste courte, non paginée). */
@Injectable()
export class ListWarehousesUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
  ) {}

  execute(filters: ListWarehousesFilters): Promise<Warehouse[]> {
    return this.warehouseRepository.findAll(filters);
  }
}
```

### ➕ Créer `src/modules/stock/application/get-warehouse-by-id.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Warehouse } from '../domain/warehouse';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Cas d'utilisation : récupérer un entrepôt (404 si inconnu). */
@Injectable()
export class GetWarehouseByIdUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
  ) {}

  async execute(warehouseId: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }
    return warehouse;
  }
}
```

### ➕ Créer `src/modules/stock/application/create-warehouse.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceAlreadyExistsException } from '../../../common/exceptions/app-exceptions';
import { Warehouse } from '../domain/warehouse';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateWarehouseInput {
  name: string;
  code: string;
  street?: string;
  city?: string;
}

/**
 * Cas d'utilisation : créer un entrepôt (ADMIN).
 * Le code est normalisé en MAJUSCULES puis son unicité est vérifiée —
 * même pattern que le SKU des produits (module 03).
 */
@Injectable()
export class CreateWarehouseUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
  ) {}

  async execute(input: CreateWarehouseInput): Promise<Warehouse> {
    const code = input.code.trim().toUpperCase();

    const existing = await this.warehouseRepository.findByCode(code);
    if (existing) {
      throw new ResourceAlreadyExistsException(
        'Un entrepôt avec ce code existe déjà.',
      );
    }

    return this.warehouseRepository.create({
      name: input.name.trim(),
      code,
      street: input.street?.trim() ?? null,
      city: input.city?.trim() ?? null,
    });
  }
}
```

### ➕ Créer `src/modules/stock/application/update-warehouse.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { Warehouse } from '../domain/warehouse';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type {
  UpdateWarehouseData,
  WarehouseRepositoryPort,
} from '../domain/warehouse-repository.port';

/** Champs modifiables (sémantique PATCH). */
export interface UpdateWarehouseInput {
  name?: string;
  code?: string;
  street?: string;
  city?: string;
  isActive?: boolean;
}

/**
 * Cas d'utilisation : modifier un entrepôt.
 *
 * isActive n'est accepté ici que pour RÉACTIVER (true) : la
 * désactivation passe obligatoirement par DELETE /warehouses/:id, qui
 * vérifie que l'entrepôt est vide. Sans ce verrou, PATCH serait une
 * porte dérobée qui contourne la règle « on ne désactive que vide ».
 */
@Injectable()
export class UpdateWarehouseUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
  ) {}

  async execute(
    warehouseId: string,
    input: UpdateWarehouseInput,
  ): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }

    if (input.isActive === false) {
      throw new BusinessRuleViolationException(
        'La désactivation passe par DELETE /warehouses/:id (elle vérifie ' +
          "que l'entrepôt est vide).",
      );
    }

    const changes: UpdateWarehouseData = { ...input };

    if (input.code !== undefined) {
      const code = input.code.trim().toUpperCase();
      const existing = await this.warehouseRepository.findByCode(code);
      // UUID SQL Server en MAJUSCULES vs paramètre d'URL : comparaison
      // insensible à la casse (cf. modules précédents).
      if (existing && existing.id.toLowerCase() !== warehouseId.toLowerCase()) {
        throw new ResourceAlreadyExistsException(
          'Un entrepôt avec ce code existe déjà.',
        );
      }
      changes.code = code;
    }

    if (input.name !== undefined) {
      changes.name = input.name.trim();
    }

    return this.warehouseRepository.update(warehouseId, changes);
  }
}
```

### ➕ Créer `src/modules/stock/application/deactivate-warehouse.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../domain/stock-level-repository.port';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/**
 * Cas d'utilisation : désactiver un entrepôt (ADMIN).
 *
 * Règle : uniquement s'il est VIDE. Sinon le stock restant deviendrait
 * invisible des opérations (un entrepôt inactif n'accepte plus de
 * mouvements) — on force l'utilisateur à transférer ou ajuster d'abord.
 */
@Injectable()
export class DeactivateWarehouseUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
  ) {}

  async execute(warehouseId: string): Promise<void> {
    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }

    // Déjà inactif : sortie silencieuse (appel idempotent).
    if (!warehouse.isActive) {
      return;
    }

    const total =
      await this.stockLevelRepository.sumQuantityForWarehouse(warehouseId);
    if (total > 0) {
      throw new BusinessRuleViolationException(
        `Impossible de désactiver cet entrepôt : il reste ${total} ` +
          'unité(s) en stock. Transférez ou ajustez le stock d’abord.',
      );
    }

    await this.warehouseRepository.deactivate(warehouseId);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 7 — Les cas d'utilisation : stock (6)

Les quatre use cases d'écriture suivent le même squelette : **vérifier** (produit stockable, entrepôts actifs, stock suffisant) puis **écrire atomiquement** via le `StockWriterPort`. Ils réutilisent `GetProductByIdUseCase` du module catalogue — c'est lui qui gère le 404 produit, et le modèle `Product` porte déjà la méthode `isStockManaged()`.

### ➕ Créer `src/modules/stock/application/get-stock-levels.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { StockLevelView } from '../domain/stock-level';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type {
  ListStockLevelsQuery,
  StockLevelRepositoryPort,
} from '../domain/stock-level-repository.port';

/** Cas d'utilisation : consulter les niveaux de stock (vue enrichie). */
@Injectable()
export class GetStockLevelsUseCase {
  constructor(
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
  ) {}

  execute(
    query: ListStockLevelsQuery,
  ): Promise<PaginatedResult<StockLevelView>> {
    return this.stockLevelRepository.findAllViews(query);
  }
}
```

### ➕ Créer `src/modules/stock/application/record-stock-in.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { StockMovement } from '../domain/stock-movement';
import { StockMovementType } from '../domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../domain/stock-level-repository.port';
import { STOCK_WRITER } from '../domain/stock-writer.port';
import type { StockWriterPort } from '../domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Données d'entrée (déjà validées par le DTO). */
export interface RecordStockInInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number;
  reference?: string;
  notes?: string;
}

/**
 * Cas d'utilisation : entrée de stock (réception, achat).
 *
 * Règles :
 *   - le produit doit exister ET être un bien physique (les SERVICES
 *     n'ont pas de stock) ;
 *   - l'entrepôt doit exister et être ACTIF ;
 *   - écriture atomique : mouvement IN + niveau (quantité += X).
 */
@Injectable()
export class RecordStockInUseCase {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: RecordStockInInput,
  ): Promise<StockMovement> {
    const product = await this.getProductByIdUseCase.execute(input.productId);
    if (!product.isStockManaged()) {
      throw new BusinessRuleViolationException(
        "Un service n'a pas de stock : seuls les articles de type " +
          'PRODUCT peuvent faire l’objet de mouvements.',
      );
    }

    const warehouse = await this.warehouseRepository.findById(
      input.warehouseId,
    );
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }
    if (!warehouse.isActive) {
      throw new BusinessRuleViolationException(
        `L'entrepôt ${warehouse.code} est désactivé : aucun mouvement possible.`,
      );
    }

    const level = await this.stockLevelRepository.findOne(
      input.productId,
      input.warehouseId,
    );
    const currentQuantity = level?.quantity ?? 0;

    const [movement] = await this.stockWriter.write(
      [
        {
          productId: input.productId,
          warehouseId: input.warehouseId,
          targetWarehouseId: null,
          type: StockMovementType.In,
          quantity: input.quantity,
          unitCost: input.unitCost ?? null,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          performedBy: actor.userId,
          performedAt: new Date(),
        },
      ],
      [
        {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: currentQuantity + input.quantity,
        },
      ],
    );

    return movement;
  }
}
```

### ➕ Créer `src/modules/stock/application/record-stock-out.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { StockMovement } from '../domain/stock-movement';
import { StockMovementType } from '../domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../domain/stock-level-repository.port';
import { STOCK_WRITER } from '../domain/stock-writer.port';
import type { StockWriterPort } from '../domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Données d'entrée (déjà validées par le DTO). */
export interface RecordStockOutInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  reference?: string;
  notes?: string;
}

/**
 * Cas d'utilisation : sortie de stock (vente, consommation).
 *
 * Règle centrale : le stock disponible doit suffire — le message
 * d'erreur dit PRÉCISÉMENT combien est disponible et combien est
 * demandé. En cas d'accès concurrents, la contrainte CHECK en base
 * est le filet de sécurité final.
 */
@Injectable()
export class RecordStockOutUseCase {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: RecordStockOutInput,
  ): Promise<StockMovement> {
    const product = await this.getProductByIdUseCase.execute(input.productId);
    if (!product.isStockManaged()) {
      throw new BusinessRuleViolationException(
        "Un service n'a pas de stock : seuls les articles de type " +
          'PRODUCT peuvent faire l’objet de mouvements.',
      );
    }

    const warehouse = await this.warehouseRepository.findById(
      input.warehouseId,
    );
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }
    if (!warehouse.isActive) {
      throw new BusinessRuleViolationException(
        `L'entrepôt ${warehouse.code} est désactivé : aucun mouvement possible.`,
      );
    }

    const level = await this.stockLevelRepository.findOne(
      input.productId,
      input.warehouseId,
    );
    const currentQuantity = level?.quantity ?? 0;

    if (currentQuantity < input.quantity) {
      throw new BusinessRuleViolationException(
        `Stock insuffisant : ${currentQuantity} disponible(s), ` +
          `${input.quantity} demandé(s).`,
      );
    }

    const [movement] = await this.stockWriter.write(
      [
        {
          productId: input.productId,
          warehouseId: input.warehouseId,
          targetWarehouseId: null,
          type: StockMovementType.Out,
          quantity: input.quantity,
          unitCost: null,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          performedBy: actor.userId,
          performedAt: new Date(),
        },
      ],
      [
        {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: currentQuantity - input.quantity,
        },
      ],
    );

    return movement;
  }
}
```

### ➕ Créer `src/modules/stock/application/transfer-stock.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { StockMovementType } from '../domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../domain/stock-level-repository.port';
import { STOCK_WRITER } from '../domain/stock-writer.port';
import type { StockWriterPort } from '../domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Données d'entrée (déjà validées par le DTO). */
export interface TransferStockInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
}

/** Niveau résultant d'un côté du transfert. */
export interface TransferredLevel {
  warehouseId: string;
  quantity: number;
}

/** Résultat du transfert : les deux niveaux mis à jour. */
export interface TransferResult {
  productId: string;
  from: TransferredLevel;
  to: TransferredLevel;
}

/**
 * Cas d'utilisation : transfert de stock entre deux entrepôts.
 *
 * LE cas qui justifie la transaction : 2 mouvements (TRANSFER côté
 * source, IN côté cible) + 2 niveaux, écrits atomiquement. Un plantage
 * au milieu ne peut PAS faire disparaître (ni dupliquer) du stock.
 */
@Injectable()
export class TransferStockUseCase {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: TransferStockInput,
  ): Promise<TransferResult> {
    if (
      input.fromWarehouseId.toLowerCase() === input.toWarehouseId.toLowerCase()
    ) {
      throw new BusinessRuleViolationException(
        "L'entrepôt source et l'entrepôt cible doivent être différents.",
      );
    }

    const product = await this.getProductByIdUseCase.execute(input.productId);
    if (!product.isStockManaged()) {
      throw new BusinessRuleViolationException(
        "Un service n'a pas de stock : seuls les articles de type " +
          'PRODUCT peuvent faire l’objet de mouvements.',
      );
    }

    const source = await this.warehouseRepository.findById(
      input.fromWarehouseId,
    );
    if (!source) {
      throw new ResourceNotFoundException("L'entrepôt source");
    }
    const target = await this.warehouseRepository.findById(
      input.toWarehouseId,
    );
    if (!target) {
      throw new ResourceNotFoundException("L'entrepôt cible");
    }
    if (!source.isActive || !target.isActive) {
      throw new BusinessRuleViolationException(
        'Les deux entrepôts doivent être actifs pour un transfert.',
      );
    }

    const sourceLevel = await this.stockLevelRepository.findOne(
      input.productId,
      input.fromWarehouseId,
    );
    const sourceQuantity = sourceLevel?.quantity ?? 0;
    if (sourceQuantity < input.quantity) {
      throw new BusinessRuleViolationException(
        `Stock insuffisant dans l'entrepôt source : ${sourceQuantity} ` +
          `disponible(s), ${input.quantity} demandé(s).`,
      );
    }

    const targetLevel = await this.stockLevelRepository.findOne(
      input.productId,
      input.toWarehouseId,
    );
    const targetQuantity = targetLevel?.quantity ?? 0;

    const performedAt = new Date();
    const notes = input.notes ?? null;

    await this.stockWriter.write(
      [
        // Côté source : TRANSFER, avec l'entrepôt de destination tracé.
        {
          productId: input.productId,
          warehouseId: input.fromWarehouseId,
          targetWarehouseId: input.toWarehouseId,
          type: StockMovementType.Transfer,
          quantity: input.quantity,
          unitCost: null,
          reference: null,
          notes,
          performedBy: actor.userId,
          performedAt,
        },
        // Côté cible : IN (la marchandise arrive), mêmes notes.
        {
          productId: input.productId,
          warehouseId: input.toWarehouseId,
          targetWarehouseId: null,
          type: StockMovementType.In,
          quantity: input.quantity,
          unitCost: null,
          reference: null,
          notes,
          performedBy: actor.userId,
          performedAt,
        },
      ],
      [
        {
          productId: input.productId,
          warehouseId: input.fromWarehouseId,
          quantity: sourceQuantity - input.quantity,
        },
        {
          productId: input.productId,
          warehouseId: input.toWarehouseId,
          quantity: targetQuantity + input.quantity,
        },
      ],
    );

    return {
      productId: input.productId,
      from: {
        warehouseId: input.fromWarehouseId,
        quantity: sourceQuantity - input.quantity,
      },
      to: {
        warehouseId: input.toWarehouseId,
        quantity: targetQuantity + input.quantity,
      },
    };
  }
}
```

### ➕ Créer `src/modules/stock/application/adjust-stock.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { StockMovement } from '../domain/stock-movement';
import { StockMovementType } from '../domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../domain/stock-level-repository.port';
import { STOCK_WRITER } from '../domain/stock-writer.port';
import type { StockWriterPort } from '../domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Données d'entrée (déjà validées par le DTO — notes OBLIGATOIRES). */
export interface AdjustStockInput {
  productId: string;
  warehouseId: string;
  /** Quantité CIBLE après inventaire (>= 0), pas un delta. */
  newQuantity: number;
  notes: string;
}

/**
 * Cas d'utilisation : ajustement d'inventaire.
 *
 * L'utilisateur saisit la quantité RÉELLEMENT comptée ; le use case
 * calcule l'écart. Le mouvement ADJUSTMENT enregistre |écart| (spec),
 * et l'écart signé est ajouté aux notes (« stock : 10 → 7 ») pour que
 * l'historique reste interprétable.
 */
@Injectable()
export class AdjustStockUseCase {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: AdjustStockInput,
  ): Promise<StockMovement> {
    const product = await this.getProductByIdUseCase.execute(input.productId);
    if (!product.isStockManaged()) {
      throw new BusinessRuleViolationException(
        "Un service n'a pas de stock : seuls les articles de type " +
          'PRODUCT peuvent faire l’objet de mouvements.',
      );
    }

    const warehouse = await this.warehouseRepository.findById(
      input.warehouseId,
    );
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }
    if (!warehouse.isActive) {
      throw new BusinessRuleViolationException(
        `L'entrepôt ${warehouse.code} est désactivé : aucun mouvement possible.`,
      );
    }

    const level = await this.stockLevelRepository.findOne(
      input.productId,
      input.warehouseId,
    );
    const currentQuantity = level?.quantity ?? 0;

    const delta = input.newQuantity - currentQuantity;
    if (delta === 0) {
      throw new BusinessRuleViolationException(
        'La quantité saisie est identique au stock actuel : aucun ' +
          'ajustement à enregistrer.',
      );
    }

    const [movement] = await this.stockWriter.write(
      [
        {
          productId: input.productId,
          warehouseId: input.warehouseId,
          targetWarehouseId: null,
          type: StockMovementType.Adjustment,
          quantity: Math.abs(delta),
          unitCost: null,
          reference: null,
          notes: `${input.notes} (stock : ${currentQuantity} → ${input.newQuantity})`,
          performedBy: actor.userId,
          performedAt: new Date(),
        },
      ],
      [
        {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: input.newQuantity,
        },
      ],
    );

    return movement;
  }
}
```

### ➕ Créer `src/modules/stock/application/list-stock-movements.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { StockMovement } from '../domain/stock-movement';
import { STOCK_MOVEMENT_REPOSITORY } from '../domain/stock-movement-repository.port';
import type {
  ListStockMovementsQuery,
  StockMovementRepositoryPort,
} from '../domain/stock-movement-repository.port';

/** Cas d'utilisation : consulter l'historique des mouvements. */
@Injectable()
export class ListStockMovementsUseCase {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY)
    private readonly stockMovementRepository: StockMovementRepositoryPort,
  ) {}

  execute(
    query: ListStockMovementsQuery,
  ): Promise<PaginatedResult<StockMovement>> {
    return this.stockMovementRepository.findAll(query);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 8 — Les DTOs

> Crée le dossier `src/modules/stock/presentation/dto/`.

### ➕ Créer `src/modules/stock/presentation/dto/list-warehouses-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query string de GET /warehouses (liste courte : pas de pagination). */
export class ListWarehousesQueryDto {
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

### ➕ Créer `src/modules/stock/presentation/dto/create-warehouse.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Corps de POST /warehouses (ADMIN). */
export class CreateWarehouseDto {
  @ApiProperty({ example: 'Entrepôt Paris Nord' })
  @IsString()
  @MinLength(1, { message: "Le nom de l'entrepôt est obligatoire." })
  @MaxLength(100, {
    message: "Le nom de l'entrepôt ne peut pas dépasser 100 caractères.",
  })
  name!: string;

  @ApiProperty({
    description: 'Code court unique (normalisé en MAJUSCULES).',
    example: 'WH-PARIS',
  })
  @Matches(/^[A-Za-z0-9-]{2,20}$/, {
    message: 'Le code doit faire 2 à 20 caractères (lettres, chiffres, tirets).',
  })
  code!: string;

  @ApiPropertyOptional({ example: '12 rue de la Logistique' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @ApiPropertyOptional({ example: 'Saint-Denis' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}
```

### ➕ Créer `src/modules/stock/presentation/dto/update-warehouse.dto.ts`

```typescript
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWarehouseDto } from './create-warehouse.dto';

/**
 * Corps de PATCH /warehouses/:id — tout optionnel + isActive.
 * isActive: false est REFUSÉ par le use case (la désactivation passe
 * par DELETE, qui vérifie que l'entrepôt est vide).
 */
export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {
  @ApiPropertyOptional({
    description: 'true pour réactiver. false refusé : passer par DELETE.',
  })
  @IsOptional()
  @IsBoolean({ message: 'Le champ "isActive" doit valoir true ou false.' })
  isActive?: boolean;
}
```

### ➕ Créer `src/modules/stock/presentation/dto/warehouse-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Warehouse } from '../../domain/warehouse';

/** Représentation publique d'un entrepôt. */
export class WarehouseResponseDto {
  @ApiProperty({ description: "Identifiant de l'entrepôt (UUID)." })
  id!: string;

  @ApiProperty({ example: 'Entrepôt Paris Nord' })
  name!: string;

  @ApiProperty({ example: 'WH-PARIS' })
  code!: string;

  @ApiProperty({ nullable: true })
  street!: string | null;

  @ApiProperty({ nullable: true })
  city!: string | null;

  @ApiProperty({ description: 'False = désactivé (plus aucun mouvement).' })
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(warehouse: Warehouse): WarehouseResponseDto {
    const dto = new WarehouseResponseDto();
    dto.id = warehouse.id;
    dto.name = warehouse.name;
    dto.code = warehouse.code;
    dto.street = warehouse.street;
    dto.city = warehouse.city;
    dto.isActive = warehouse.isActive;
    dto.createdAt = warehouse.createdAt;
    dto.updatedAt = warehouse.updatedAt;
    return dto;
  }
}
```

### ➕ Créer `src/modules/stock/presentation/dto/list-stock-levels-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';

/** Query string de GET /stock (hérite de la pagination du socle). */
export class ListStockLevelsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtre par produit.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "productId" doit être un UUID valide.',
  })
  productId?: string;

  @ApiPropertyOptional({ description: 'Filtre par entrepôt.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "warehouseId" doit être un UUID valide.',
  })
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'true = uniquement les stocks bas (quantité < 5).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({
    message: 'Le paramètre "lowStock" doit valoir true ou false.',
  })
  lowStock?: boolean;
}
```

### ➕ Créer `src/modules/stock/presentation/dto/stock-level-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { StockLevelView } from '../../domain/stock-level';

/** Ligne de l'écran de stock : niveau ENRICHI des noms lisibles. */
export class StockLevelResponseDto {
  @ApiProperty({ description: 'Identifiant du produit (UUID).' })
  productId!: string;

  @ApiProperty({ example: 'PROD-0001' })
  productSku!: string;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  productName!: string;

  @ApiProperty({ description: "Identifiant de l'entrepôt (UUID)." })
  warehouseId!: string;

  @ApiProperty({ example: 'Entrepôt Paris Nord' })
  warehouseName!: string;

  @ApiProperty({ example: 12 })
  quantity!: number;

  @ApiProperty({ description: 'Date du dernier mouvement appliqué.' })
  updatedAt!: Date;

  static fromView(view: StockLevelView): StockLevelResponseDto {
    const dto = new StockLevelResponseDto();
    dto.productId = view.productId;
    dto.productSku = view.productSku;
    dto.productName = view.productName;
    dto.warehouseId = view.warehouseId;
    dto.warehouseName = view.warehouseName;
    dto.quantity = view.quantity;
    dto.updatedAt = view.updatedAt;
    return dto;
  }
}
```

### ➕ Créer `src/modules/stock/presentation/dto/record-stock-in.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/** Corps de POST /stock/in (tout utilisateur connecté). */
export class RecordStockInDto {
  @ApiProperty({ description: 'Produit concerné (type PRODUCT).' })
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId!: string;

  @ApiProperty({ description: 'Entrepôt de réception (actif).' })
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId!: string;

  @ApiProperty({ description: 'Quantité reçue (entier > 0).', example: 10 })
  @IsInt({ message: 'La quantité doit être un entier.' })
  @IsPositive({ message: 'La quantité doit être strictement positive.' })
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Coût unitaire HT en EUR (2 décimales max).',
    example: 220,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le coût unitaire doit être un nombre (2 décimales max).' },
  )
  @Min(0, { message: 'Le coût unitaire ne peut pas être négatif.' })
  unitCost?: number;

  @ApiPropertyOptional({
    description: 'Référence externe (ex. : commande fournisseur).',
    example: 'CMD-F-2026-0042',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### ➕ Créer `src/modules/stock/presentation/dto/record-stock-out.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Corps de POST /stock/out (tout utilisateur connecté). */
export class RecordStockOutDto {
  @ApiProperty({ description: 'Produit concerné (type PRODUCT).' })
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId!: string;

  @ApiProperty({ description: 'Entrepôt de sortie (actif).' })
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId!: string;

  @ApiProperty({ description: 'Quantité sortie (entier > 0).', example: 3 })
  @IsInt({ message: 'La quantité doit être un entier.' })
  @IsPositive({ message: 'La quantité doit être strictement positive.' })
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Référence externe (ex. : bon de livraison).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### ➕ Créer `src/modules/stock/presentation/dto/transfer-stock.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Corps de POST /stock/transfer (ADMIN et MANAGER). */
export class TransferStockDto {
  @ApiProperty({ description: 'Produit concerné (type PRODUCT).' })
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId!: string;

  @ApiProperty({ description: 'Entrepôt source (actif).' })
  @IsUUID(undefined, {
    message: 'Le fromWarehouseId doit être un UUID valide.',
  })
  fromWarehouseId!: string;

  @ApiProperty({ description: 'Entrepôt cible (actif, différent du source).' })
  @IsUUID(undefined, {
    message: 'Le toWarehouseId doit être un UUID valide.',
  })
  toWarehouseId!: string;

  @ApiProperty({ description: 'Quantité transférée (entier > 0).', example: 4 })
  @IsInt({ message: 'La quantité doit être un entier.' })
  @IsPositive({ message: 'La quantité doit être strictement positive.' })
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### ➕ Créer `src/modules/stock/presentation/dto/adjust-stock.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Corps de POST /stock/adjust (ADMIN et MANAGER). */
export class AdjustStockDto {
  @ApiProperty({ description: 'Produit concerné (type PRODUCT).' })
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId!: string;

  @ApiProperty({ description: 'Entrepôt concerné (actif).' })
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId!: string;

  @ApiProperty({
    description: 'Quantité RÉELLEMENT comptée (cible, pas un delta).',
    example: 7,
  })
  @IsInt({ message: 'La quantité doit être un entier.' })
  @Min(0, { message: 'La quantité ne peut pas être négative.' })
  newQuantity!: number;

  @ApiProperty({
    description:
      'Justification OBLIGATOIRE : un ajustement sans explication est ' +
      'un trou dans la traçabilité d’inventaire.',
    example: 'Casse constatée lors de l’inventaire trimestriel.',
  })
  @IsString()
  @MinLength(1, { message: 'Les notes sont obligatoires pour un ajustement.' })
  @MaxLength(400, {
    message: 'Les notes ne peuvent pas dépasser 400 caractères.',
  })
  notes!: string;
}
```

> 📌 400 caractères et pas 500 : le use case AJOUTE `(stock : X → Y)` aux notes avant écriture — on garde de la marge pour ne jamais dépasser la colonne `nvarchar(500)`.

### ➕ Créer `src/modules/stock/presentation/dto/list-stock-movements-query.dto.ts`

```typescript
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { StockMovementType } from '../../domain/stock-movement-type.enum';

/**
 * Query string de GET /stock/movements.
 *
 * IntersectionType fusionne DEUX DTOs du socle : la pagination ET la
 * plage de dates (from/to sur performedAt) — TypeScript n'autorise
 * qu'un seul extends, ce helper de @nestjs/swagger combine les
 * validations et la doc des deux.
 */
export class ListStockMovementsQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ description: 'Filtre par produit.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "productId" doit être un UUID valide.',
  })
  productId?: string;

  @ApiPropertyOptional({ description: 'Filtre par entrepôt (source).' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "warehouseId" doit être un UUID valide.',
  })
  warehouseId?: string;

  @ApiPropertyOptional({ enum: StockMovementType })
  @IsOptional()
  @IsEnum(StockMovementType, {
    message: 'Le type doit valoir IN, OUT, ADJUSTMENT ou TRANSFER.',
  })
  type?: StockMovementType;
}
```

### ➕ Créer `src/modules/stock/presentation/dto/stock-movement-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { StockMovement } from '../../domain/stock-movement';
import { StockMovementType } from '../../domain/stock-movement-type.enum';

/**
 * Représentation publique d'un mouvement de stock.
 * Version minimale : expose les ids ; les noms produit/entrepôt joints
 * dans l'historique arrivent au niveau min- (même pattern de jointure
 * que GET /stock).
 */
export class StockMovementResponseDto {
  @ApiProperty({ description: 'Identifiant du mouvement (UUID).' })
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ description: 'Entrepôt concerné (source pour un TRANSFER).' })
  warehouseId!: string;

  @ApiProperty({
    description: 'Entrepôt de destination — TRANSFER uniquement.',
    nullable: true,
  })
  targetWarehouseId!: string | null;

  @ApiProperty({ enum: StockMovementType })
  type!: StockMovementType;

  @ApiProperty({ description: 'Toujours positive (direction = type).' })
  quantity!: number;

  @ApiProperty({ nullable: true, example: 220 })
  unitCost!: number | null;

  @ApiProperty({ nullable: true })
  reference!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: "UUID de l'utilisateur qui a agi." })
  performedBy!: string;

  @ApiProperty()
  performedAt!: Date;

  static fromDomain(movement: StockMovement): StockMovementResponseDto {
    const dto = new StockMovementResponseDto();
    dto.id = movement.id;
    dto.productId = movement.productId;
    dto.warehouseId = movement.warehouseId;
    dto.targetWarehouseId = movement.targetWarehouseId;
    dto.type = movement.type;
    dto.quantity = movement.quantity;
    dto.unitCost = movement.unitCost;
    dto.reference = movement.reference;
    dto.notes = movement.notes;
    dto.performedBy = movement.performedBy;
    dto.performedAt = movement.performedAt;
    return dto;
  }
}
```

### ➕ Créer `src/modules/stock/presentation/dto/transfer-result.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { TransferResult } from '../../application/transfer-stock.use-case';

/** Un côté du transfert : l'entrepôt et sa nouvelle quantité. */
export class TransferredLevelDto {
  @ApiProperty()
  warehouseId!: string;

  @ApiProperty({ description: 'Quantité APRÈS transfert.' })
  quantity!: number;
}

/** Réponse de POST /stock/transfer : les deux niveaux mis à jour. */
export class TransferResultDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ type: TransferredLevelDto })
  from!: TransferredLevelDto;

  @ApiProperty({ type: TransferredLevelDto })
  to!: TransferredLevelDto;

  static fromResult(result: TransferResult): TransferResultDto {
    const dto = new TransferResultDto();
    dto.productId = result.productId;
    dto.from = { ...result.from };
    dto.to = { ...result.to };
    return dto;
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 9 — Les deux contrôleurs

### ➕ Créer `src/modules/stock/presentation/warehouses.controller.ts`

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
import { CreateWarehouseUseCase } from '../application/create-warehouse.use-case';
import { DeactivateWarehouseUseCase } from '../application/deactivate-warehouse.use-case';
import { GetWarehouseByIdUseCase } from '../application/get-warehouse-by-id.use-case';
import { ListWarehousesUseCase } from '../application/list-warehouses.use-case';
import { UpdateWarehouseUseCase } from '../application/update-warehouse.use-case';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseResponseDto } from './dto/warehouse-response.dto';

/**
 * Contrôleur des entrepôts.
 * Lecture ouverte à tous les rôles ; création/désactivation ADMIN ;
 * modification ADMIN/MANAGER.
 */
@ApiTags('Stocks — Entrepôts')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(
    private readonly listWarehousesUseCase: ListWarehousesUseCase,
    private readonly getWarehouseByIdUseCase: GetWarehouseByIdUseCase,
    private readonly createWarehouseUseCase: CreateWarehouseUseCase,
    private readonly updateWarehouseUseCase: UpdateWarehouseUseCase,
    private readonly deactivateWarehouseUseCase: DeactivateWarehouseUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste des entrepôts (non paginée)',
    description: 'Filtre optionnel : isActive.',
  })
  @ApiOkResponse({ type: [WarehouseResponseDto] })
  async list(
    @Query() query: ListWarehousesQueryDto,
  ): Promise<WarehouseResponseDto[]> {
    const warehouses = await this.listWarehousesUseCase.execute({
      isActive: query.isActive,
    });
    return warehouses.map(WarehouseResponseDto.fromDomain);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un entrepôt" })
  @ApiOkResponse({ type: WarehouseResponseDto })
  @ApiNotFoundResponse({ description: 'Entrepôt inconnu.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.getWarehouseByIdUseCase.execute(id);
    return WarehouseResponseDto.fromDomain(warehouse);
  }

  @Post()
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Créer un entrepôt' })
  @ApiCreatedResponse({ type: WarehouseResponseDto })
  @ApiConflictResponse({
    description: 'Code déjà utilisé (RESOURCE_ALREADY_EXISTS).',
  })
  async create(
    @Body() body: CreateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.createWarehouseUseCase.execute(body);
    return WarehouseResponseDto.fromDomain(warehouse);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Modifier un entrepôt',
    description:
      'isActive: true réactive ; isActive: false est refusé (utiliser ' +
      'DELETE, qui vérifie que l’entrepôt est vide).',
  })
  @ApiOkResponse({ type: WarehouseResponseDto })
  @ApiNotFoundResponse({ description: 'Entrepôt inconnu.' })
  @ApiConflictResponse({
    description:
      'Code déjà utilisé, ou tentative de désactivation via PATCH.',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.updateWarehouseUseCase.execute(id, body);
    return WarehouseResponseDto.fromDomain(warehouse);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Désactiver un entrepôt',
    description: 'Refusé (409) si du stock reste dedans. Idempotent.',
  })
  @ApiNoContentResponse({ description: 'Entrepôt désactivé.' })
  @ApiConflictResponse({
    description: 'Entrepôt non vide (BUSINESS_RULE_VIOLATION).',
  })
  async deactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.deactivateWarehouseUseCase.execute(id);
  }
}
```

### ➕ Créer `src/modules/stock/presentation/stock.controller.ts`

```typescript
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { AdjustStockUseCase } from '../application/adjust-stock.use-case';
import { GetStockLevelsUseCase } from '../application/get-stock-levels.use-case';
import { ListStockMovementsUseCase } from '../application/list-stock-movements.use-case';
import { RecordStockInUseCase } from '../application/record-stock-in.use-case';
import { RecordStockOutUseCase } from '../application/record-stock-out.use-case';
import { TransferStockUseCase } from '../application/transfer-stock.use-case';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ListStockLevelsQueryDto } from './dto/list-stock-levels-query.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { RecordStockInDto } from './dto/record-stock-in.dto';
import { RecordStockOutDto } from './dto/record-stock-out.dto';
import { StockLevelResponseDto } from './dto/stock-level-response.dto';
import { StockMovementResponseDto } from './dto/stock-movement-response.dto';
import { TransferResultDto } from './dto/transfer-result.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';

/**
 * Contrôleur du stock : consultation des niveaux, historique des
 * mouvements, et les quatre écritures (in / out / transfer / adjust).
 *
 * Entrées et sorties sont ouvertes à tous les rôles (opérations du
 * quotidien d'un magasinier) ; transfert et ajustement, plus sensibles,
 * sont réservés ADMIN/MANAGER.
 */
@ApiTags('Stocks')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(
    private readonly getStockLevelsUseCase: GetStockLevelsUseCase,
    private readonly listStockMovementsUseCase: ListStockMovementsUseCase,
    private readonly recordStockInUseCase: RecordStockInUseCase,
    private readonly recordStockOutUseCase: RecordStockOutUseCase,
    private readonly transferStockUseCase: TransferStockUseCase,
    private readonly adjustStockUseCase: AdjustStockUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Niveaux de stock (paginés, enrichis)',
    description:
      'Filtres : productId, warehouseId, lowStock (quantité < 5), ' +
      'search (SKU / nom du produit).',
  })
  @ApiOkResponse({ type: [StockLevelResponseDto] })
  async getLevels(
    @Query() query: ListStockLevelsQueryDto,
  ): Promise<PaginatedResult<StockLevelResponseDto>> {
    const result = await this.getStockLevelsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      productId: query.productId,
      warehouseId: query.warehouseId,
      lowStock: query.lowStock,
    });

    return {
      items: result.items.map(StockLevelResponseDto.fromView),
      meta: result.meta,
    };
  }

  @Get('movements')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Historique des mouvements (paginé)',
    description:
      'Filtres : productId, warehouseId, type, from/to (ISO 8601), ' +
      'search (référence / notes). Tri par défaut : plus récents d’abord.',
  })
  @ApiOkResponse({ type: [StockMovementResponseDto] })
  async listMovements(
    @Query() query: ListStockMovementsQueryDto,
  ): Promise<PaginatedResult<StockMovementResponseDto>> {
    const result = await this.listStockMovementsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      productId: query.productId,
      warehouseId: query.warehouseId,
      type: query.type,
      // Les query params sont du texte : conversion en Date ici, la
      // validation du format ISO ayant déjà été faite par le DTO.
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(StockMovementResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Post('in')
  @ApiOperation({ summary: 'Entrée de stock (réception, achat)' })
  @ApiCreatedResponse({ type: StockMovementResponseDto })
  @ApiNotFoundResponse({ description: 'Produit ou entrepôt inconnu.' })
  @ApiConflictResponse({
    description: 'Article SERVICE ou entrepôt désactivé.',
  })
  async recordIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordStockInDto,
  ): Promise<StockMovementResponseDto> {
    const movement = await this.recordStockInUseCase.execute(user, body);
    return StockMovementResponseDto.fromDomain(movement);
  }

  @Post('out')
  @ApiOperation({ summary: 'Sortie de stock (vente, consommation)' })
  @ApiCreatedResponse({ type: StockMovementResponseDto })
  @ApiNotFoundResponse({ description: 'Produit ou entrepôt inconnu.' })
  @ApiConflictResponse({
    description:
      'Stock insuffisant, article SERVICE ou entrepôt désactivé.',
  })
  async recordOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordStockOutDto,
  ): Promise<StockMovementResponseDto> {
    const movement = await this.recordStockOutUseCase.execute(user, body);
    return StockMovementResponseDto.fromDomain(movement);
  }

  @Post('transfer')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Transfert entre entrepôts (atomique)',
    description:
      'Écrit 2 mouvements + 2 niveaux dans UNE transaction SQL : tout ' +
      'réussit ou tout est annulé.',
  })
  @ApiCreatedResponse({ type: TransferResultDto })
  @ApiNotFoundResponse({ description: 'Produit ou entrepôt inconnu.' })
  @ApiConflictResponse({
    description:
      'Source = cible, stock source insuffisant, article SERVICE ou ' +
      'entrepôt désactivé.',
  })
  async transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: TransferStockDto,
  ): Promise<TransferResultDto> {
    const result = await this.transferStockUseCase.execute(user, body);
    return TransferResultDto.fromResult(result);
  }

  @Post('adjust')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: "Ajustement d'inventaire",
    description:
      'newQuantity = quantité réellement comptée. Notes obligatoires ; ' +
      'l’écart (stock : X → Y) y est ajouté automatiquement.',
  })
  @ApiCreatedResponse({ type: StockMovementResponseDto })
  @ApiNotFoundResponse({ description: 'Produit ou entrepôt inconnu.' })
  @ApiConflictResponse({
    description:
      'Aucun écart, article SERVICE ou entrepôt désactivé.',
  })
  async adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdjustStockDto,
  ): Promise<StockMovementResponseDto> {
    const movement = await this.adjustStockUseCase.execute(user, body);
    return StockMovementResponseDto.fromDomain(movement);
  }
}
```

**À retenir :**
- **`@Get('movements')` AVANT tout futur `@Get(':id')`** : ce contrôleur n'a pas de route `:id` aujourd'hui, mais le `GET /stock/:productId` du niveau min- devra être déclaré APRÈS `movements` (piège des routes du module 01).
- Les quatre écritures reçoivent **`@CurrentUser()`** : chaque mouvement porte QUI a agi (`performedBy`) — sans module d'audit, l'historique est déjà nominatif.

**✅ Point de contrôle** : `npm run build`

---

## Étape 10 — Le module + AppModule

### ➕ Créer `src/modules/stock/stock.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { AdjustStockUseCase } from './application/adjust-stock.use-case';
import { CreateWarehouseUseCase } from './application/create-warehouse.use-case';
import { DeactivateWarehouseUseCase } from './application/deactivate-warehouse.use-case';
import { GetStockLevelsUseCase } from './application/get-stock-levels.use-case';
import { GetWarehouseByIdUseCase } from './application/get-warehouse-by-id.use-case';
import { ListStockMovementsUseCase } from './application/list-stock-movements.use-case';
import { ListWarehousesUseCase } from './application/list-warehouses.use-case';
import { RecordStockInUseCase } from './application/record-stock-in.use-case';
import { RecordStockOutUseCase } from './application/record-stock-out.use-case';
import { TransferStockUseCase } from './application/transfer-stock.use-case';
import { UpdateWarehouseUseCase } from './application/update-warehouse.use-case';
import { STOCK_LEVEL_REPOSITORY } from './domain/stock-level-repository.port';
import { STOCK_MOVEMENT_REPOSITORY } from './domain/stock-movement-repository.port';
import { STOCK_WRITER } from './domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from './domain/warehouse-repository.port';
import { StockLevelEntity } from './infrastructure/entities/stock-level.entity';
import { StockMovementEntity } from './infrastructure/entities/stock-movement.entity';
import { WarehouseEntity } from './infrastructure/entities/warehouse.entity';
import { StockLevelMapper } from './infrastructure/stock-level.mapper';
import { StockMovementMapper } from './infrastructure/stock-movement.mapper';
import { TransactionalStockWriter } from './infrastructure/transactional-stock-writer';
import { TypeOrmStockLevelRepository } from './infrastructure/typeorm-stock-level.repository';
import { TypeOrmStockMovementRepository } from './infrastructure/typeorm-stock-movement.repository';
import { TypeOrmWarehouseRepository } from './infrastructure/typeorm-warehouse.repository';
import { WarehouseMapper } from './infrastructure/warehouse.mapper';
import { StockController } from './presentation/stock.controller';
import { WarehousesController } from './presentation/warehouses.controller';

/**
 * Module de gestion des stocks (entrepôts, niveaux, mouvements).
 *
 * Imports :
 *   - CatalogueModule : fournit GetProductByIdUseCase (validation des
 *     produits mouvementés) ;
 *   - DatabaseModule : fournit TransactionService (writer atomique).
 *     NestJS n'instancie chaque module qu'UNE fois : l'importer ici ne
 *     crée pas de seconde connexion SQL.
 *
 * STOCK_LEVEL_REPOSITORY, STOCK_WRITER et WAREHOUSE_REPOSITORY sont
 * exportés : le module commandes (06) en aura besoin pour mouvementer
 * le stock à la livraison/réception et valider l'entrepôt choisi.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseEntity,
      StockLevelEntity,
      StockMovementEntity,
    ]),
    CatalogueModule,
    DatabaseModule,
  ],
  controllers: [WarehousesController, StockController],
  providers: [
    WarehouseMapper,
    StockLevelMapper,
    StockMovementMapper,
    ListWarehousesUseCase,
    GetWarehouseByIdUseCase,
    CreateWarehouseUseCase,
    UpdateWarehouseUseCase,
    DeactivateWarehouseUseCase,
    GetStockLevelsUseCase,
    ListStockMovementsUseCase,
    RecordStockInUseCase,
    RecordStockOutUseCase,
    TransferStockUseCase,
    AdjustStockUseCase,
    {
      provide: WAREHOUSE_REPOSITORY,
      useClass: TypeOrmWarehouseRepository,
    },
    {
      provide: STOCK_LEVEL_REPOSITORY,
      useClass: TypeOrmStockLevelRepository,
    },
    {
      provide: STOCK_MOVEMENT_REPOSITORY,
      useClass: TypeOrmStockMovementRepository,
    },
    {
      provide: STOCK_WRITER,
      useClass: TransactionalStockWriter,
    },
  ],
  exports: [STOCK_LEVEL_REPOSITORY, STOCK_WRITER, WAREHOUSE_REPOSITORY],
})
export class StockModule {}
```

### ✏️ Modifier `src/app.module.ts`

**1)** Ajoute l'import :

```typescript
import { StockModule } from './modules/stock/stock.module';
```

**2)** Dans le tableau `imports`, ajoute `StockModule` juste après `CatalogueModule` :

**AVANT** :

```typescript
    CatalogueModule,
    AuthenticationModule,
```

**APRÈS** :

```typescript
    CatalogueModule,
    StockModule,
    AuthenticationModule,
```

> 💡 Si tu n'as pas fait le module 02, ton fichier n'a pas `ContactsModule` — peu importe : l'essentiel est que `StockModule` soit ajouté après `CatalogueModule`.

**✅ Point de contrôle** :

```bash
npm run build
npm run start:dev
```

Les logs listent les 11 routes (`/api/v1/warehouses*` et `/api/v1/stock*`) ; Swagger affiche deux sections « Stocks — Entrepôts » et « Stocks ».

---

## Étape 11 — Vérifier que ça marche & ce qu'on verra plus tard

### 11.1 Parcours manuel (PowerShell)

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion en ADMIN
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

# 2. Créer deux entrepôts
$paris = Invoke-RestMethod -Method Post -Uri "$base/warehouses" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Entrepôt Paris Nord","code":"wh-paris","city":"Saint-Denis"}'
$paris.data.code   # → WH-PARIS : normalisé en MAJUSCULES
$lyon = Invoke-RestMethod -Method Post -Uri "$base/warehouses" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Entrepôt Lyon","code":"WH-LYON","city":"Corbas"}'

# 3. Créer un produit et un service (module 03)
$prod = Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Écran Dell 27\" QHD","type":"PRODUCT","unit":"UNIT","unitPrice":349.90}'
$svc = Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Installation sur site","type":"SERVICE","unit":"HOUR","unitPrice":85}'

# 4. Entrée de 10 unités à Paris (avec coût et référence fournisseur)
Invoke-RestMethod -Method Post -Uri "$base/stock/in" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"productId":"' + $prod.data.id + '","warehouseId":"' + $paris.data.id + '",' +
         '"quantity":10,"unitCost":220,"reference":"CMD-F-2026-0042"}') | Out-Null

# 5. La règle des services : mouvement sur le SERVICE → 409
try {
  Invoke-RestMethod -Method Post -Uri "$base/stock/in" -Headers $headers `
    -ContentType 'application/json' `
    -Body ('{"productId":"' + $svc.data.id + '","warehouseId":"' + $paris.data.id + '","quantity":5}')
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 6. L'écran de stock : niveaux ENRICHIS (noms, pas des UUID)
Invoke-RestMethod -Uri "$base/stock" -Headers $headers | ConvertTo-Json -Depth 5

# 7. Sortie de 3 unités (vente) → il en reste 7
Invoke-RestMethod -Method Post -Uri "$base/stock/out" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"productId":"' + $prod.data.id + '","warehouseId":"' + $paris.data.id + '","quantity":3}') | Out-Null

# 8. Sortie impossible : le message dit combien il reste
try {
  Invoke-RestMethod -Method Post -Uri "$base/stock/out" -Headers $headers `
    -ContentType 'application/json' `
    -Body ('{"productId":"' + $prod.data.id + '","warehouseId":"' + $paris.data.id + '","quantity":999}')
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 9. LE transfert atomique : 4 unités Paris → Lyon
Invoke-RestMethod -Method Post -Uri "$base/stock/transfer" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"productId":"' + $prod.data.id + '","fromWarehouseId":"' + $paris.data.id + '",' +
         '"toWarehouseId":"' + $lyon.data.id + '","quantity":4}') |
  ConvertTo-Json -Depth 5   # → from: 3, to: 4

# 10. Transfert vers soi-même → 409
try {
  Invoke-RestMethod -Method Post -Uri "$base/stock/transfer" -Headers $headers `
    -ContentType 'application/json' `
    -Body ('{"productId":"' + $prod.data.id + '","fromWarehouseId":"' + $paris.data.id + '",' +
           '"toWarehouseId":"' + $paris.data.id + '","quantity":1}')
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 11. Inventaire à Lyon : on ne compte que 2 écrans (casse) → ADJUSTMENT
Invoke-RestMethod -Method Post -Uri "$base/stock/adjust" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"productId":"' + $prod.data.id + '","warehouseId":"' + $lyon.data.id + '",' +
         '"newQuantity":2,"notes":"Casse constatée lors de l’inventaire"}') |
  ConvertTo-Json -Depth 5   # notes : « ... (stock : 4 → 2) »

# 12. Les stocks bas (quantité < 5) : Paris (3) et Lyon (2) ressortent
Invoke-RestMethod -Uri "$base/stock?lowStock=true" -Headers $headers |
  ConvertTo-Json -Depth 5

# 13. Désactiver Paris avec du stock dedans → 409, message avec la quantité
try {
  Invoke-WebRequest -Method Delete -Uri "$base/warehouses/$($paris.data.id)" `
    -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 14. Vider Paris (inventaire à 0) puis désactiver → 204
Invoke-RestMethod -Method Post -Uri "$base/stock/adjust" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"productId":"' + $prod.data.id + '","warehouseId":"' + $paris.data.id + '",' +
         '"newQuantity":0,"notes":"Fermeture de l’entrepôt de démonstration"}') | Out-Null
Invoke-WebRequest -Method Delete -Uri "$base/warehouses/$($paris.data.id)" `
  -Headers $headers | Select-Object StatusCode

# 15. L'historique : ~7 mouvements, du plus récent au plus ancien
Invoke-RestMethod -Uri "$base/stock/movements" -Headers $headers |
  ConvertTo-Json -Depth 5
```

Même parcours possible à la souris dans **Swagger**.

### 11.2 Les pièges croisés en route (mémo)

| Piège | Parade |
|---|---|
| Clé primaire composite : pas de colonne `id` | Deux `@PrimaryColumn`, pas d'héritage `AuditableEntity` |
| `save()` sur une PK composite | = upsert (INSERT ou UPDATE) — exactement la sémantique d'un niveau de stock |
| Deux sorties simultanées « croisent » la vérification applicative | La contrainte `CHECK (quantity >= 0)` fait échouer la 2e transaction : jamais de stock négatif |
| Un repository global utilisé DANS une transaction en sort silencieusement | Toutes les écritures du writer passent par `manager.getRepository(...)` |
| Les agrégats SQL (`SUM`) arrivent parfois en chaîne côté JS | `Number(raw.total)` |
| `toView()` suppose les relations chargées | `innerJoinAndSelect` obligatoire dans `findAllViews` |
| `PATCH isActive:false` contournerait la règle « on ne désactive que vide » | Refusé en use case : la désactivation passe par DELETE |
| Dates de filtre en query string (toujours du texte) | `DateRangeDto` du socle (via `IntersectionType`) + `new Date()` dans le contrôleur |

### 11.3 Ce qu'on verra plus tard (rien n'est perdu)

| Différé | Pourquoi ce n'est pas bloquant | Niveau |
|---|---|---|
| **`GET /stock/:productId`** (niveaux d'un produit dans tous les entrepôts) | Strictement équivalent à `GET /stock?productId=...`, déjà disponible | 🟡 min- |
| **Noms produit/entrepôt dans l'historique des mouvements** | Même pattern de jointure que `GET /stock` ; les ids suffisent à un écran d'admin | 🟡 min- |
| **Quantités décimales** (kg, litres) | Les entiers couvrent la vente à la pièce ; le décimal exige une arithmétique soignée (jamais de float sur un stock) | 🟡 min- |
| **`hasMouvements`** sur les entrepôts | Aucun use case de la spec ne l'exploite ; la désactivation « si vide » suffit | 🟡 min- |
| **Audit** (`warehouses.*`, `stock.*`) | `performedBy` rend déjà chaque mouvement nominatif ; le journal d'audit central est un plus | 🟡 min- |
| **Tests** (unit : stock insuffisant, atomicité, dernier contrôle d'entrepôt ; intégration : upsert ; e2e : in → transfer → out) | L'application fonctionne ; garantie long terme | 🔴 complet |

### 11.4 Ce que ce module t'a appris de nouveau

1. **La transaction SQL** : le `TransactionService` + le pattern « writer » — un port de domaine qui promet l'atomicité, une implémentation qui la réalise avec l'`EntityManager` transactionnel. Les modules 05 à 08 (devis → commandes → factures → paiements) en useront à chaque changement d'état.
2. **La clé primaire composite** : l'identité d'un niveau de stock EST le couple (produit, entrepôt) — le schéma garantit l'unicité mieux qu'aucun code.
3. **La contrainte `CHECK`** : la règle métier critique (« jamais négatif ») est défendue par le use case (message clair) ET par la base (filet anti-concurrence). Ceinture et bretelles.
4. **Le read model** : `StockLevel` (calculs) et `StockLevelView` (affichage, jointures) sont deux formes distinctes — on ne tord pas le modèle de domaine pour les besoins d'un écran.
5. **L'entité immuable comme journal** : un mouvement ne s'édite jamais, il se compense — c'est ce qui rend un historique digne de confiance (même principe que la comptabilité, et que les audit logs du socle).
6. **La réutilisation inter-modules** : `GetProductByIdUseCase` importé du catalogue via les exports de son module — pas de duplication, pas de dépendance circulaire.

---

*Fin du guide mini-DEV-04. Prochain module : les devis (05) — premier document commercial, avec lignes, totaux HT/TVA/TTC (le transformer decimal va servir !) et numérotation auto (`DEV-2026-0001`, le pattern du SKU en plus riche).*
