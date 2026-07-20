# mini-DEV-06 · Commandes (Clients & Fournisseurs) — l'essentiel pour démarrer

> **Spec couverte** : `specs/06-commandes/06-commandes.md` (version minimale)
> **Niveau** : 🟢 fonctionnel — même logique que les `mini-DEV-01` à `05` (voir `RECAP-DEV-01` pour la philosophie des 3 niveaux).
> **Prérequis** : `mini-DEV-01` à `mini-DEV-05` TOUS terminés — c'est le module qui fait converger contacts (02), catalogue (03), stocks (04) et devis (05).
> **Promesse** : à la fin, des commandes clients ET fournisseurs avec un cycle de vie complet (brouillon → confirmée → en livraison → livrée, annulable en route), qui **pilotent le stock automatiquement** : la sortie au départ en livraison, l'entrée à la réception fournisseur, la réinjection en cas d'annulation. Et la boucle promise au module 05 se ferme : `POST /quotes/:id/convert` transforme un devis accepté en commande. 10 routes dans Swagger. Environ 4 h.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — Le domaine : enums, lignes, commande, totaux](#étape-1--le-domaine--enums-lignes-commande-totaux)
- [Étape 2 — Le port du repository](#étape-2--le-port-du-repository)
- [Étape 3 — Les entités TypeORM et le mapper](#étape-3--les-entités-typeorm-et-le-mapper)
- [Étape 4 — La migration](#étape-4--la-migration)
- [Étape 5 — Le repository](#étape-5--le-repository)
- [Étape 6 — Les cas d'utilisation : CRUD (6)](#étape-6--les-cas-dutilisation--crud-6)
- [Étape 7 — Les cas d'utilisation : transitions & stock (5)](#étape-7--les-cas-dutilisation--transitions--stock-5)
- [Étape 8 — Les DTOs](#étape-8--les-dtos)
- [Étape 9 — Le contrôleur](#étape-9--le-contrôleur)
- [Étape 10 — Le module + AppModule (+ une retouche au module 04)](#étape-10--le-module--appmodule--une-retouche-au-module-04)
- [Étape 11 — La conversion devis → commande](#étape-11--la-conversion-devis--commande)
- [Étape 12 — Vérifier que ça marche & ce qu'on verra plus tard](#étape-12--vérifier-que-ça-marche--ce-quon-verra-plus-tard)

---

## 0 · Avant de commencer

- API démarrée, base à jour, tables `contacts`, `products`, `warehouses`, `stock_levels`, `stock_movements`, `quotes` présentes (modules 02 à 05 appliqués).
- Pour les rappels sur le socle : section A de `mini-DEV-01`.

### Les nouveautés de ce module

1. **Un module, deux métiers.** `CUSTOMER` (commande d'un client → le stock SORT à la livraison) et `SUPPLIER` (commande à un fournisseur → le stock ENTRE à la réception). Même cycle de vie, effets de stock opposés.
2. **Les transitions à effets de bord.** Jusqu'ici, une transition changeait un statut. Ici, `start` sort du stock, `complete` en fait entrer, `cancel` réinjecte ce qui était sorti — et tout passe par le **StockWriter transactionnel du module 04** (exporté exprès à l'époque : le moment est venu).
3. **L'écriture compensatrice.** On n'« annule » jamais un mouvement de stock (journal immuable, module 04) : on écrit le mouvement INVERSE, avec la référence `ANNULATION CMD-XXXX`. Comme en comptabilité.
4. **L'agrégation avant vérification.** Deux lignes de commande peuvent porter le même produit : on agrège les quantités PAR PRODUIT avant de vérifier le stock — sinon chaque ligne passerait individuellement alors que leur somme dépasse le disponible.
5. **La conversion inter-modules.** Le devis accepté devient commande : lignes copiées avec **remise fondue dans le prix unitaire** (les lignes de commande n'ont pas de colonne remise), `quoteId` tracé, double conversion interdite.

**Choix assumés de cette version** : la facturation (`POST /orders/:id/invoice`) attend le module 07 ; l'audit et les tests sont différés comme d'habitude. Détail au § final.

---

## B · Ce qu'on va construire

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/orders` | tout connecté | Liste paginée ; filtres `type`, `status`, `contactId`, `from`, `to`, `search` |
| `GET /api/v1/orders/:id` | tout connecté | Détail avec lignes et nom du contact |
| `POST /api/v1/orders` | ADMIN, MANAGER | Créer (DRAFT, numéro `CMD-`/`CDF-`, totaux serveur) |
| `PATCH /api/v1/orders/:id` | ADMIN, MANAGER | Modifier — DRAFT ou CONFIRMED uniquement |
| `DELETE /api/v1/orders/:id` | ADMIN | Supprimer — DRAFT uniquement (204) |
| `POST /api/v1/orders/:id/confirm` | ADMIN, MANAGER | DRAFT → CONFIRMED |
| `POST /api/v1/orders/:id/start` | tout connecté | CONFIRMED → IN_PROGRESS (**sortie de stock** si CUSTOMER) |
| `POST /api/v1/orders/:id/complete` | tout connecté | IN_PROGRESS → DELIVERED (**entrée de stock** si SUPPLIER) |
| `POST /api/v1/orders/:id/cancel` | ADMIN, MANAGER | → CANCELLED (**stock réinjecté** si parti en livraison) |
| `POST /api/v1/quotes/:id/convert` | ADMIN, MANAGER | Devis ACCEPTED → commande CUSTOMER (201) |

**Le cycle de vie** :

```
DRAFT ──confirm──▶ CONFIRMED ──start──▶ IN_PROGRESS ──complete──▶ DELIVERED
  │                    │                    │
  └────────────────────┴──────cancel────────┘        (DELIVERED ne s'annule plus)
```

**Les règles métier incluses** :

- cohérence contact/type : commande CUSTOMER → contact `CUSTOMER`/`BOTH` ; commande SUPPLIER → contact `SUPPLIER`/`BOTH` ;
- numérotation séparée : `CMD-2026-NNNN` (clients) / `CDF-2026-NNNN` (fournisseurs) ;
- stock CUSTOMER : sorti au `start` (entrepôt précisé dans le body), vérifié APRÈS agrégation par produit — insuffisant = 409, rien ne bouge ;
- stock SUPPLIER : entré au `complete`, avec le prix d'achat de la ligne comme `unitCost` du mouvement ;
- annulation : possible depuis tout statut sauf `DELIVERED` (et `CANCELLED`) ; si la commande était partie en livraison, les sorties sont réinjectées (référence `ANNULATION CMD-XXXX`) ;
- seules les lignes de produits STOCKÉS (type PRODUCT) bougent le stock — les services sont ignorés ; une quantité non entière sur un produit stocké bloque la livraison (le stock du module 04 est en entiers) ;
- modification DRAFT/CONFIRMED ; suppression physique DRAFT uniquement.

**31 fichiers créés, 3 modifiés** (`app.module.ts`, `quotes.module.ts` + contrôleur des devis pour la conversion, et une retouche d'export au `stock.module.ts`), **1 migration générée**.

---

## Étape 1 — Le domaine : enums, lignes, commande, totaux

> Crée l'arborescence `src/modules/orders/domain/`.

### ➕ Créer `src/modules/orders/domain/order-type.enum.ts`

```typescript
/**
 * Sens d'une commande.
 *
 * CUSTOMER : un client nous commande — le stock SORT à la livraison.
 * SUPPLIER : nous commandons à un fournisseur — le stock ENTRE à la
 *            réception.
 */
export enum OrderType {
  Customer = 'CUSTOMER',
  Supplier = 'SUPPLIER',
}
```

### ➕ Créer `src/modules/orders/domain/order-status.enum.ts`

```typescript
/**
 * Cycle de vie d'une commande. Transitions AUTORISÉES :
 *
 *   DRAFT ─confirm─▶ CONFIRMED ─start─▶ IN_PROGRESS ─complete─▶ DELIVERED
 *     └───────────────────┴─────cancel──────┘
 *
 * CANCELLED est accessible depuis tout état SAUF DELIVERED (une
 * commande livrée ne s'annule plus : le module 07 gérera l'avoir).
 * Modification : DRAFT et CONFIRMED. Suppression : DRAFT.
 */
export enum OrderStatus {
  Draft = 'DRAFT',
  Confirmed = 'CONFIRMED',
  InProgress = 'IN_PROGRESS',
  Delivered = 'DELIVERED',
  Cancelled = 'CANCELLED',
}
```

### ➕ Créer `src/modules/orders/domain/order-line.ts`

```typescript
/**
 * Ligne de commande. Même principe de FIGEMENT qu'au module 05 : la
 * ligne copie description, prix et TVA au moment de sa création.
 * Pas de colonne remise : à la conversion d'un devis, la remise est
 * fondue dans le prix unitaire.
 */
export class OrderLine {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    /** null = ligne libre (article hors catalogue). */
    public readonly productId: string | null,
    public readonly description: string,
    public readonly quantity: number,
    /** Prix unitaire HT en EUR, figé à la création. */
    public readonly unitPrice: number,
    /** Taux de TVA en % (0, 5.5, 10, 20), figé à la création. */
    public readonly vatRate: number,
    /** quantité × prix, arrondi au centime. */
    public readonly subtotalHT: number,
  ) {}
}
```

### ➕ Créer `src/modules/orders/domain/order.ts`

```typescript
import { OrderLine } from './order-line';
import { OrderStatus } from './order-status.enum';
import { OrderType } from './order-type.enum';

/**
 * Commande — agrégat racine, client OU fournisseur selon `type`.
 *
 * warehouseId mémorise l'entrepôt utilisé par la logistique : posé au
 * départ en livraison (CUSTOMER, pour savoir OÙ réinjecter en cas
 * d'annulation) ou à la réception (SUPPLIER).
 */
export class Order {
  constructor(
    public readonly id: string,
    /** CMD-2026-0001 (client) ou CDF-2026-0001 (fournisseur). */
    public readonly number: string,
    public readonly type: OrderType,
    public readonly contactId: string,
    /** Nom du contact, dénormalisé pour l'affichage (jointure lecture). */
    public readonly contactName: string,
    public readonly status: OrderStatus,
    /** Devis d'origine si la commande vient d'une conversion. */
    public readonly quoteId: string | null,
    /** Entrepôt de livraison/réception, posé par les transitions. */
    public readonly warehouseId: string | null,
    public readonly notes: string | null,
    public readonly totalHT: number,
    public readonly totalVAT: number,
    public readonly totalTTC: number,
    public readonly expectedDeliveryDate: Date | null,
    public readonly deliveredAt: Date | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** Vide dans les listes ; complet dans le détail. */
    public readonly lines: OrderLine[],
  ) {}

  isDraft(): boolean {
    return this.status === OrderStatus.Draft;
  }

  isConfirmed(): boolean {
    return this.status === OrderStatus.Confirmed;
  }

  isInProgress(): boolean {
    return this.status === OrderStatus.InProgress;
  }

  /** Modifiable tant que la logistique n'a pas commencé. */
  isEditable(): boolean {
    return this.isDraft() || this.isConfirmed();
  }

  /** Annulable depuis tout état sauf livrée ou déjà annulée. */
  isCancellable(): boolean {
    return (
      this.status !== OrderStatus.Delivered &&
      this.status !== OrderStatus.Cancelled
    );
  }
}
```

### ➕ Créer `src/modules/orders/domain/order-totals.ts`

Même logique qu'au module 05, sans la remise (elle n'existe pas sur une ligne de commande).

```typescript
import { roundMoney } from '../../../common/money/money';

/** Ligne prête à calculer (contenu déjà résolu par le use case). */
export interface OrderLineDraft {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

/** Ligne calculée : le sous-total HT est posé. */
export interface ComputedOrderLine extends OrderLineDraft {
  subtotalHT: number;
}

/** Totaux d'une commande. */
export interface OrderTotals {
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

/** Pose le sous-total (qté × prix, au centime) de chaque ligne. */
export function computeOrderLines(lines: OrderLineDraft[]): ComputedOrderLine[] {
  return lines.map((line) => ({
    ...line,
    subtotalHT: roundMoney(line.quantity * line.unitPrice),
  }));
}

/** Totaux de la commande — TVA ligne par ligne, arrondie à chaque étape. */
export function computeOrderTotals(lines: ComputedOrderLine[]): OrderTotals {
  const totalHT = roundMoney(
    lines.reduce((sum, line) => sum + line.subtotalHT, 0),
  );
  const totalVAT = roundMoney(
    lines.reduce(
      (sum, line) => sum + roundMoney((line.subtotalHT * line.vatRate) / 100),
      0,
    ),
  );
  return {
    totalHT,
    totalVAT,
    totalTTC: roundMoney(totalHT + totalVAT),
  };
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 2 — Le port du repository

### ➕ Créer `src/modules/orders/domain/order-repository.port.ts`

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Order } from './order';
import { OrderStatus } from './order-status.enum';
import { OrderType } from './order-type.enum';
import { ComputedOrderLine } from './order-totals';

/** Critères de listing des commandes. */
export interface ListOrdersQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur le numéro et le nom du contact. */
  search?: string;
  type?: OrderType;
  status?: OrderStatus;
  contactId?: string;
  /** Bornes sur la date de création (incluses). */
  from?: Date;
  to?: Date;
}

/** Données de création (tout est déjà résolu et calculé). */
export interface CreateOrderData {
  number: string;
  type: OrderType;
  contactId: string;
  status: OrderStatus;
  quoteId: string | null;
  notes: string | null;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  expectedDeliveryDate: Date | null;
  createdBy: string;
  lines: ComputedOrderLine[];
}

/**
 * Champs modifiables. Les champs status / warehouseId / deliveredAt
 * sont pilotés EXCLUSIVEMENT par les use cases de transition — jamais
 * exposés à l'API de modification.
 */
export interface UpdateOrderData {
  contactId?: string;
  notes?: string | null;
  expectedDeliveryDate?: Date | null;
  totalHT?: number;
  totalVAT?: number;
  totalTTC?: number;
  /** Remplacement COMPLET des lignes si fourni. */
  lines?: ComputedOrderLine[];
  status?: OrderStatus;
  warehouseId?: string | null;
  deliveredAt?: Date | null;
}

/** Contrat de persistance des commandes. */
export interface OrderRepositoryPort {
  /** Liste paginée (contact joint, SANS les lignes). */
  findAll(query: ListOrdersQuery): Promise<PaginatedResult<Order>>;

  /** Détail complet (lignes triées + contact) ; null si inconnue. */
  findById(id: string): Promise<Order | null>;

  /** True si un devis a déjà été converti (anti double conversion). */
  existsForQuote(quoteId: string): Promise<boolean>;

  /** Prochain numéro de l'année (CMD- pour CUSTOMER, CDF- pour SUPPLIER). */
  nextNumber(type: OrderType): Promise<string>;

  /** Crée la commande ET ses lignes (atomique). */
  create(data: CreateOrderData): Promise<Order>;

  /** Modifie la commande, remplace les lignes si fournies (atomique). */
  update(id: string, data: UpdateOrderData): Promise<Order>;

  /** Suppression PHYSIQUE (brouillons uniquement, lignes en cascade). */
  delete(id: string): Promise<void>;
}

/** Jeton d'injection du repository commandes. */
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 3 — Les entités TypeORM et le mapper

> Crée l'arborescence `src/modules/orders/infrastructure/entities/`.

### ➕ Créer `src/modules/orders/infrastructure/entities/order.entity.ts`

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { ContactEntity } from '../../../contacts/infrastructure/entities/contact.entity';
import { QuoteEntity } from '../../../quotes/infrastructure/entities/quote.entity';
import { WarehouseEntity } from '../../../stock/infrastructure/entities/warehouse.entity';
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';
import { OrderLineEntity } from './order-line.entity';

/**
 * Entité TypeORM de la table `orders`.
 * Même patron qu'au module 05 (quotes) : cascade d'insertion des
 * lignes, relations déclarées pour les clés étrangères SQL.
 */
@Entity({ name: 'orders' })
export class OrderEntity extends AuditableEntity {
  /** CMD-2026-0001 (client) ou CDF-2026-0001 (fournisseur), unique. */
  @Index('UQ_orders_number', { unique: true })
  @Column({ name: 'number', type: 'nvarchar', length: 20 })
  number!: string;

  @Index('IX_orders_type')
  @Column({ name: 'type', type: 'nvarchar', length: 10 })
  type!: OrderType;

  @Index('IX_orders_contact')
  @Column({ name: 'contact_id', type: 'uniqueidentifier' })
  contactId!: string;

  @ManyToOne(() => ContactEntity)
  @JoinColumn({ name: 'contact_id' })
  contact?: ContactEntity;

  @Index('IX_orders_status')
  @Column({ name: 'status', type: 'nvarchar', length: 12 })
  status!: OrderStatus;

  /** Devis d'origine si conversion (FK nullable vers quotes). */
  @Column({ name: 'quote_id', type: 'uniqueidentifier', nullable: true })
  quoteId!: string | null;

  @ManyToOne(() => QuoteEntity, { nullable: true })
  @JoinColumn({ name: 'quote_id' })
  quote?: QuoteEntity | null;

  /** Entrepôt de livraison/réception, posé par les transitions. */
  @Column({
    name: 'warehouse_id',
    type: 'uniqueidentifier',
    nullable: true,
  })
  warehouseId!: string | null;

  @ManyToOne(() => WarehouseEntity, { nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: WarehouseEntity | null;

  @Column({ name: 'notes', type: 'nvarchar', length: 2000, nullable: true })
  notes!: string | null;

  @Column({
    name: 'total_ht',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  totalHT!: number;

  @Column({
    name: 'total_vat',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  totalVAT!: number;

  @Column({
    name: 'total_ttc',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  totalTTC!: number;

  @Column({
    name: 'expected_delivery_date',
    type: 'datetime2',
    nullable: true,
  })
  expectedDeliveryDate!: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime2', nullable: true })
  deliveredAt!: Date | null;

  /** Les lignes vivent et meurent avec la commande. */
  @OneToMany(() => OrderLineEntity, (line) => line.order, {
    cascade: ['insert'],
  })
  lines?: OrderLineEntity[];
}
```

### ➕ Créer `src/modules/orders/infrastructure/entities/order-line.entity.ts`

```typescript
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { ProductEntity } from '../../../catalogue/infrastructure/entities/product.entity';
import { OrderEntity } from './order.entity';

/**
 * Entité TypeORM de la table `order_lines`.
 * onDelete: 'CASCADE' : la suppression d'un brouillon emporte ses lignes.
 */
@Entity({ name: 'order_lines' })
export class OrderLineEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Index('IX_order_lines_order')
  @Column({ name: 'order_id', type: 'uniqueidentifier' })
  orderId!: string;

  @ManyToOne(() => OrderEntity, (order) => order.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order?: OrderEntity;

  /** null = ligne libre ; sinon trace du produit d'origine. */
  @Column({ name: 'product_id', type: 'uniqueidentifier', nullable: true })
  productId!: string | null;

  @ManyToOne(() => ProductEntity, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity | null;

  /** Ordre d'affichage des lignes (0, 1, 2...). */
  @Column({ name: 'position', type: 'int' })
  position!: number;

  @Column({ name: 'description', type: 'nvarchar', length: 500 })
  description!: string;

  @Column({
    name: 'quantity',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  quantity!: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  unitPrice!: number;

  @Column({
    name: 'vat_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 20,
    transformer: new DecimalColumnTransformer(),
  })
  vatRate!: number;

  @Column({
    name: 'subtotal_ht',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  subtotalHT!: number;
}
```

### ➕ Créer `src/modules/orders/infrastructure/order.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Order } from '../domain/order';
import { OrderLine } from '../domain/order-line';
import { OrderEntity } from './entities/order.entity';
import { OrderLineEntity } from './entities/order-line.entity';

/** Conversion entités TypeORM -> modèles de domaine. */
@Injectable()
export class OrderMapper {
  toDomain(entity: OrderEntity): Order {
    const lines = [...(entity.lines ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((line) => this.lineToDomain(line));

    return new Order(
      entity.id,
      entity.number,
      entity.type,
      entity.contactId,
      entity.contact?.companyName ?? '',
      entity.status,
      entity.quoteId,
      entity.warehouseId,
      entity.notes,
      entity.totalHT,
      entity.totalVAT,
      entity.totalTTC,
      entity.expectedDeliveryDate,
      entity.deliveredAt,
      entity.createdBy,
      entity.createdAt,
      entity.updatedAt,
      lines,
    );
  }

  private lineToDomain(entity: OrderLineEntity): OrderLine {
    return new OrderLine(
      entity.id,
      entity.orderId,
      entity.productId,
      entity.description,
      entity.quantity,
      entity.unitPrice,
      entity.vatRate,
      entity.subtotalHT,
    );
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 4 — La migration

```bash
npm run migration:generate -- src/database/migrations/CreateOrdersTables
```

**Relis le fichier généré**. Tu dois y trouver :

- `CREATE TABLE "orders"` avec `UQ_orders_number` (**unique**), les index `IX_orders_type`, `IX_orders_contact`, `IX_orders_status`, les trois `decimal(12,2)` ;
- `CREATE TABLE "order_lines"` avec `position` et `product_id` nullable ;
- **cinq `FOREIGN KEY`** : `orders.contact_id → contacts`, `orders.quote_id → quotes` (nullable), `orders.warehouse_id → warehouses` (nullable), `order_lines.order_id → orders` avec **`ON DELETE CASCADE`**, `order_lines.product_id → products` ;
- un `down()` qui défait tout dans l'ordre inverse ; RIEN sur les tables existantes.

```bash
npm run migration:run
npm run migration:show   # CreateOrdersTables cochée [X]
```

**✅ Point de contrôle** : les FK de `orders` pointent vers `contacts`, `quotes` ET `warehouses` — la commande est le carrefour du système, son schéma le montre.

---

## Étape 5 — Le repository

### ➕ Créer `src/modules/orders/infrastructure/typeorm-order.repository.ts`

Même patron qu'au module 05 (relis-le si besoin : jointure du contact en liste, lignes dans le détail, remplacement transactionnel des lignes, `MAX` pour la numérotation) — seule vraie nouveauté : `nextNumber` dépend du TYPE.

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
import { TransactionService } from '../../../database/transaction/transaction.service';
import { Order } from '../domain/order';
import {
  CreateOrderData,
  ListOrdersQuery,
  OrderRepositoryPort,
  UpdateOrderData,
} from '../domain/order-repository.port';
import { OrderType } from '../domain/order-type.enum';
import { OrderEntity } from './entities/order.entity';
import { OrderLineEntity } from './entities/order-line.entity';
import { OrderMapper } from './order.mapper';

/** Liste blanche de tri (colonnes de la commande + contact joint). */
const ORDER_SORTABLE_COLUMNS: ColumnWhitelist = {
  number: 'order.number',
  type: 'order.type',
  status: 'order.status',
  totalTTC: 'order.totalTTC',
  expectedDeliveryDate: 'order.expectedDeliveryDate',
  contactName: 'contact.companyName',
  createdAt: 'order.createdAt',
};

/** Recherche textuelle : numéro et nom du contact. */
const ORDER_SEARCHABLE_COLUMNS = [
  'order.number',
  'contact.companyName',
] as const;

/** Implémentation TypeORM du repository commandes. */
@Injectable()
export class TypeOrmOrderRepository implements OrderRepositoryPort {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repository: Repository<OrderEntity>,
    private readonly transactionService: TransactionService,
    private readonly mapper: OrderMapper,
  ) {}

  async findAll(query: ListOrdersQuery): Promise<PaginatedResult<Order>> {
    const queryBuilder = this.repository
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.contact', 'contact');

    if (query.type !== undefined) {
      queryBuilder.andWhere('order.type = :type', { type: query.type });
    }
    if (query.status !== undefined) {
      queryBuilder.andWhere('order.status = :status', {
        status: query.status,
      });
    }
    if (query.contactId !== undefined) {
      queryBuilder.andWhere('order.contactId = :contactId', {
        contactId: query.contactId,
      });
    }
    if (query.from !== undefined) {
      queryBuilder.andWhere('order.createdAt >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('order.createdAt <= :to', { to: query.to });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      ORDER_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('order.createdAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        ORDER_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Order | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { contact: true, lines: true },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  existsForQuote(quoteId: string): Promise<boolean> {
    return this.repository.exists({ where: { quoteId } });
  }

  async nextNumber(type: OrderType): Promise<string> {
    const year = new Date().getFullYear();
    // Deux séquences indépendantes : CMD- (clients) et CDF- (fournisseurs).
    const prefix = `${type === OrderType.Customer ? 'CMD' : 'CDF'}-${year}-`;

    const raw = await this.repository
      .createQueryBuilder('order')
      .select('MAX(order.number)', 'max')
      .where('order.number LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    const lastSequence = raw?.max ? Number(raw.max.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
  }

  async create(data: CreateOrderData): Promise<Order> {
    const { lines, ...orderColumns } = data;

    const entity = this.repository.create({
      ...orderColumns,
      lines: lines.map((line, index) => ({ ...line, position: index })),
    });
    const saved = await this.repository.save(entity);

    return (await this.findById(saved.id)) as Order;
  }

  async update(id: string, data: UpdateOrderData): Promise<Order> {
    const { lines, ...orderColumns } = data;

    await this.transactionService.execute(async (manager) => {
      const changes: Partial<OrderEntity> = {};
      for (const [key, value] of Object.entries(orderColumns)) {
        if (value !== undefined) {
          (changes as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(changes).length > 0) {
        await manager.getRepository(OrderEntity).update({ id }, changes);
      }

      if (lines !== undefined) {
        const lineRepository = manager.getRepository(OrderLineEntity);
        await lineRepository.delete({ orderId: id });
        await lineRepository.save(
          lines.map((line, index) =>
            lineRepository.create({ ...line, orderId: id, position: index }),
          ),
        );
      }
    });

    return (await this.findById(id)) as Order;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 6 — Les cas d'utilisation : CRUD (6)

> Crée le dossier `src/modules/orders/application/`.

### ➕ Créer `src/modules/orders/application/list-orders.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type {
  ListOrdersQuery,
  OrderRepositoryPort,
} from '../domain/order-repository.port';

/** Cas d'utilisation : lister les commandes (pagination + filtres). */
@Injectable()
export class ListOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  execute(query: ListOrdersQuery): Promise<PaginatedResult<Order>> {
    return this.orderRepository.findAll(query);
  }
}
```

### ➕ Créer `src/modules/orders/application/get-order-by-id.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';

/** Cas d'utilisation : récupérer une commande complète (404 si inconnue). */
@Injectable()
export class GetOrderByIdUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new ResourceNotFoundException('La commande');
    }
    return order;
  }
}
```

### ➕ Créer `src/modules/orders/application/resolve-order-lines.helper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { computeOrderLines } from '../domain/order-totals';
import type {
  ComputedOrderLine,
  OrderLineDraft,
} from '../domain/order-totals';

/** Ligne telle que reçue de l'API (avant résolution). */
export interface OrderLineInput {
  productId?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  vatRate?: number;
}

/**
 * Résout chaque ligne de commande — même logique qu'au module 05 :
 *   - ligne PRODUIT : produit existant (404) et actif (409),
 *     description/prix/TVA copiés si non fournis puis FIGÉS ;
 *   - ligne LIBRE : description et prix obligatoires.
 */
@Injectable()
export class ResolveOrderLinesHelper {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
  ) {}

  async resolve(inputs: OrderLineInput[]): Promise<ComputedOrderLine[]> {
    const drafts: OrderLineDraft[] = [];

    for (const input of inputs) {
      if (input.productId !== undefined) {
        const product = await this.getProductByIdUseCase.execute(
          input.productId,
        );
        if (!product.isActive) {
          throw new BusinessRuleViolationException(
            `Le produit « ${product.name} » est désactivé : il ne peut ` +
              'plus être commandé.',
          );
        }
        drafts.push({
          productId: product.id,
          description: input.description ?? product.name,
          quantity: input.quantity,
          unitPrice: input.unitPrice ?? product.unitPrice,
          vatRate: input.vatRate ?? product.vatRate,
        });
      } else {
        if (input.description === undefined || input.unitPrice === undefined) {
          throw new BusinessRuleViolationException(
            'Une ligne libre (sans productId) doit préciser sa ' +
              'description et son prix unitaire.',
          );
        }
        drafts.push({
          productId: null,
          description: input.description,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          vatRate: input.vatRate ?? 20,
        });
      }
    }

    return computeOrderLines(drafts);
  }
}
```

### ➕ Créer `src/modules/orders/application/create-order.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetContactByIdUseCase } from '../../contacts/application/get-contact-by-id.use-case';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';
import { computeOrderTotals } from '../domain/order-totals';
import { OrderLineInput, ResolveOrderLinesHelper } from './resolve-order-lines.helper';

/** Données de création (déjà validées par le DTO). */
export interface CreateOrderInput {
  type: OrderType;
  contactId: string;
  notes?: string;
  expectedDeliveryDate?: string;
  lines: OrderLineInput[];
  /** Réservé à la conversion de devis (jamais exposé dans le DTO). */
  quoteId?: string;
}

/**
 * Cas d'utilisation : créer une commande (statut DRAFT).
 *
 * Règle centrale : la COHÉRENCE contact/type — une commande CUSTOMER
 * exige un contact client, une commande SUPPLIER un fournisseur
 * (BOTH passe partout, c'est sa raison d'être).
 */
@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveOrderLinesHelper: ResolveOrderLinesHelper,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateOrderInput,
  ): Promise<Order> {
    const contact = await this.getContactByIdUseCase.execute(input.contactId);

    if (input.type === OrderType.Customer && !contact.isCustomer()) {
      throw new BusinessRuleViolationException(
        `Le contact « ${contact.companyName} » n'est pas un client : ` +
          'impossible de créer une commande client pour lui.',
      );
    }
    if (input.type === OrderType.Supplier && !contact.isSupplier()) {
      throw new BusinessRuleViolationException(
        `Le contact « ${contact.companyName} » n'est pas un fournisseur : ` +
          'impossible de lui passer une commande.',
      );
    }

    const lines = await this.resolveOrderLinesHelper.resolve(input.lines);
    const totals = computeOrderTotals(lines);

    return this.orderRepository.create({
      number: await this.orderRepository.nextNumber(input.type),
      type: input.type,
      contactId: input.contactId,
      status: OrderStatus.Draft,
      quoteId: input.quoteId ?? null,
      notes: input.notes ?? null,
      ...totals,
      expectedDeliveryDate: input.expectedDeliveryDate
        ? new Date(input.expectedDeliveryDate)
        : null,
      createdBy: actor.userId,
      lines,
    });
  }
}
```

### ➕ Créer `src/modules/orders/application/update-order.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetContactByIdUseCase } from '../../contacts/application/get-contact-by-id.use-case';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type {
  OrderRepositoryPort,
  UpdateOrderData,
} from '../domain/order-repository.port';
import { OrderType } from '../domain/order-type.enum';
import { computeOrderTotals } from '../domain/order-totals';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';
import { OrderLineInput, ResolveOrderLinesHelper } from './resolve-order-lines.helper';

/** Champs modifiables (le TYPE ne change jamais après création). */
export interface UpdateOrderInput {
  contactId?: string;
  notes?: string;
  expectedDeliveryDate?: string;
  lines?: OrderLineInput[];
}

/**
 * Cas d'utilisation : modifier une commande — DRAFT ou CONFIRMED
 * uniquement (dès que la logistique a commencé, plus rien ne bouge).
 */
@Injectable()
export class UpdateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveOrderLinesHelper: ResolveOrderLinesHelper,
  ) {}

  async execute(orderId: string, input: UpdateOrderInput): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isEditable()) {
      throw new BusinessRuleViolationException(
        `Seule une commande en brouillon ou confirmée est modifiable ` +
          `(statut actuel : ${order.status}).`,
      );
    }

    const changes: UpdateOrderData = {};

    if (input.contactId !== undefined) {
      const contact = await this.getContactByIdUseCase.execute(
        input.contactId,
      );
      const compatible =
        order.type === OrderType.Customer
          ? contact.isCustomer()
          : contact.isSupplier();
      if (!compatible) {
        throw new BusinessRuleViolationException(
          `Le contact « ${contact.companyName} » ne correspond pas au ` +
            `type de la commande (${order.type}).`,
        );
      }
      changes.contactId = input.contactId;
    }

    if (input.notes !== undefined) {
      changes.notes = input.notes;
    }
    if (input.expectedDeliveryDate !== undefined) {
      changes.expectedDeliveryDate = new Date(input.expectedDeliveryDate);
    }

    if (input.lines !== undefined) {
      const lines = await this.resolveOrderLinesHelper.resolve(input.lines);
      const totals = computeOrderTotals(lines);
      changes.lines = lines;
      changes.totalHT = totals.totalHT;
      changes.totalVAT = totals.totalVAT;
      changes.totalTTC = totals.totalTTC;
    }

    return this.orderRepository.update(orderId, changes);
  }
}
```

### ➕ Créer `src/modules/orders/application/delete-order.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/**
 * Cas d'utilisation : supprimer une commande — BROUILLON UNIQUEMENT
 * (même philosophie qu'au module 05 : au-delà, on ANNULE, on ne
 * supprime pas — l'historique doit rester).
 */
@Injectable()
export class DeleteOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
  ) {}

  async execute(orderId: string): Promise<void> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une commande en brouillon peut être supprimée (statut ` +
          `actuel : ${order.status}). Utilisez l'annulation.`,
      );
    }

    await this.orderRepository.delete(orderId);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 7 — Les cas d'utilisation : transitions & stock (5)

C'est ici que les modules 03, 04 et 06 s'emboîtent. Trois use cases partagent le même besoin : « quelles lignes de cette commande bougent du stock, et de combien ? » — on le factorise d'abord.

### ➕ Créer `src/modules/orders/application/collect-stock-lines.helper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { Order } from '../domain/order';

/** Ligne de commande qui doit bouger du stock. */
export interface StockLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Extrait d'une commande les lignes qui impactent le stock :
 *   - lignes AVEC productId et produit de type PRODUCT (les services
 *     et les lignes libres sont ignorés) ;
 *   - la quantité doit être ENTIÈRE : le stock du module 04 compte en
 *     unités entières — 2.5 écrans ne veut rien dire.
 */
@Injectable()
export class CollectStockLinesHelper {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
  ) {}

  async collect(order: Order): Promise<StockLine[]> {
    const stockLines: StockLine[] = [];

    for (const line of order.lines) {
      if (line.productId === null) {
        continue;
      }
      const product = await this.getProductByIdUseCase.execute(line.productId);
      if (!product.isStockManaged()) {
        continue;
      }
      if (!Number.isInteger(line.quantity)) {
        throw new BusinessRuleViolationException(
          `La ligne « ${line.description} » porte une quantité non ` +
            `entière (${line.quantity}) sur un produit stocké : ` +
            'impossible de mouvementer le stock.',
        );
      }
      stockLines.push({
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      });
    }

    return stockLines;
  }

  /**
   * Agrège les quantités PAR PRODUIT : deux lignes du même produit
   * doivent être vérifiées (et écrites) comme UNE demande cumulée —
   * sinon chaque ligne passerait le contrôle de stock alors que leur
   * somme le dépasse.
   */
  aggregateByProduct(stockLines: StockLine[]): Map<string, number> {
    const totals = new Map<string, number>();
    for (const line of stockLines) {
      totals.set(
        line.productId,
        (totals.get(line.productId) ?? 0) + line.quantity,
      );
    }
    return totals;
  }
}
```

### ➕ Créer `src/modules/orders/application/confirm-order.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/** Cas d'utilisation : confirmer une commande (DRAFT -> CONFIRMED). */
@Injectable()
export class ConfirmOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
  ) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une commande en brouillon peut être confirmée (statut ` +
          `actuel : ${order.status}).`,
      );
    }

    return this.orderRepository.update(orderId, {
      status: OrderStatus.Confirmed,
    });
  }
}
```

### ➕ Créer `src/modules/orders/application/start-delivery.use-case.ts`

**LA transition à effet de bord.** Pour une commande CLIENT, partir en livraison = sortir le stock — atomiquement, via le `StockWriter` du module 04.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { StockMovementType } from '../../stock/domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../../stock/domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../../stock/domain/stock-level-repository.port';
import { STOCK_WRITER } from '../../stock/domain/stock-writer.port';
import type {
  NewStockMovementData,
  StockLevelWrite,
  StockWriterPort,
} from '../../stock/domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from '../../stock/domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../../stock/domain/warehouse-repository.port';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';
import { CollectStockLinesHelper } from './collect-stock-lines.helper';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/** Options de départ en livraison. */
export interface StartDeliveryInput {
  /** Entrepôt de sortie — OBLIGATOIRE si la commande a des lignes stockées. */
  warehouseId?: string;
}

/**
 * Cas d'utilisation : départ en livraison (CONFIRMED -> IN_PROGRESS).
 *
 * Commande CUSTOMER : le stock SORT, en une seule écriture atomique
 * (mouvements + niveaux via StockWriter). Vérifications AVANT toute
 * écriture : quantités agrégées par produit, chaque produit doit être
 * disponible — sinon 409 et RIEN ne bouge.
 *
 * Commande SUPPLIER : simple transition (le stock entrera à la
 * réception, voir CompleteOrderUseCase).
 */
@Injectable()
export class StartDeliveryUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly collectStockLinesHelper: CollectStockLinesHelper,
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    orderId: string,
    input: StartDeliveryInput,
  ): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isConfirmed()) {
      throw new BusinessRuleViolationException(
        `Seule une commande confirmée peut partir en livraison (statut ` +
          `actuel : ${order.status}).`,
      );
    }

    let warehouseId: string | null = null;

    if (order.type === OrderType.Customer) {
      const stockLines = await this.collectStockLinesHelper.collect(order);

      if (stockLines.length > 0) {
        warehouseId = await this.resolveWarehouse(input.warehouseId);

        // Vérification APRÈS agrégation : deux lignes du même produit
        // sont une seule demande cumulée.
        const needed = this.collectStockLinesHelper.aggregateByProduct(
          stockLines,
        );
        const newLevels: StockLevelWrite[] = [];
        for (const [productId, quantity] of needed) {
          const level = await this.stockLevelRepository.findOne(
            productId,
            warehouseId,
          );
          const available = level?.quantity ?? 0;
          if (available < quantity) {
            throw new BusinessRuleViolationException(
              `Stock insuffisant pour livrer ${order.number} : ` +
                `${available} disponible(s), ${quantity} demandé(s) ` +
                `(produit ${productId}).`,
            );
          }
          newLevels.push({
            productId,
            warehouseId,
            quantity: available - quantity,
          });
        }

        // Un mouvement OUT par ligne (traçabilité fine), les niveaux
        // agrégés par produit — le tout dans UNE transaction.
        const performedAt = new Date();
        const movements: NewStockMovementData[] = stockLines.map((line) => ({
          productId: line.productId,
          warehouseId: warehouseId as string,
          targetWarehouseId: null,
          type: StockMovementType.Out,
          quantity: line.quantity,
          unitCost: null,
          reference: order.number,
          notes: `Livraison ${order.number} — ${line.description}`,
          performedBy: actor.userId,
          performedAt,
        }));

        await this.stockWriter.write(movements, newLevels);
      }
    }

    return this.orderRepository.update(orderId, {
      status: OrderStatus.InProgress,
      // Mémorisé pour savoir OÙ réinjecter en cas d'annulation.
      warehouseId,
    });
  }

  /** L'entrepôt de sortie doit être fourni, exister et être actif. */
  private async resolveWarehouse(warehouseId?: string): Promise<string> {
    if (warehouseId === undefined) {
      throw new BusinessRuleViolationException(
        'Cette commande contient des produits stockés : précisez ' +
          "l'entrepôt de sortie (warehouseId).",
      );
    }
    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }
    if (!warehouse.isActive) {
      throw new BusinessRuleViolationException(
        `L'entrepôt ${warehouse.code} est désactivé : aucun mouvement possible.`,
      );
    }
    return warehouse.id;
  }
}
```

### ➕ Créer `src/modules/orders/application/complete-order.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { StockMovementType } from '../../stock/domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../../stock/domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../../stock/domain/stock-level-repository.port';
import { STOCK_WRITER } from '../../stock/domain/stock-writer.port';
import type {
  NewStockMovementData,
  StockLevelWrite,
  StockWriterPort,
} from '../../stock/domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from '../../stock/domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../../stock/domain/warehouse-repository.port';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';
import { CollectStockLinesHelper } from './collect-stock-lines.helper';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/** Options de clôture de livraison. */
export interface CompleteOrderInput {
  /** Entrepôt de réception — OBLIGATOIRE si commande SUPPLIER avec
   *  produits stockés. */
  warehouseId?: string;
}

/**
 * Cas d'utilisation : clôturer la livraison (IN_PROGRESS -> DELIVERED).
 *
 * Commande SUPPLIER : la marchandise ARRIVE — entrées de stock avec le
 * prix d'achat de la ligne comme unitCost du mouvement (le coût entre
 * dans l'historique).
 * Commande CUSTOMER : simple transition (le stock est déjà sorti au
 * départ en livraison) + deliveredAt posé.
 */
@Injectable()
export class CompleteOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly collectStockLinesHelper: CollectStockLinesHelper,
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    orderId: string,
    input: CompleteOrderInput,
  ): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isInProgress()) {
      throw new BusinessRuleViolationException(
        `Seule une commande en cours de livraison peut être clôturée ` +
          `(statut actuel : ${order.status}).`,
      );
    }

    let warehouseId: string | null = order.warehouseId;

    if (order.type === OrderType.Supplier) {
      const stockLines = await this.collectStockLinesHelper.collect(order);

      if (stockLines.length > 0) {
        warehouseId = await this.resolveWarehouse(input.warehouseId);

        const needed = this.collectStockLinesHelper.aggregateByProduct(
          stockLines,
        );
        const newLevels: StockLevelWrite[] = [];
        for (const [productId, quantity] of needed) {
          const level = await this.stockLevelRepository.findOne(
            productId,
            warehouseId,
          );
          newLevels.push({
            productId,
            warehouseId,
            quantity: (level?.quantity ?? 0) + quantity,
          });
        }

        const performedAt = new Date();
        const movements: NewStockMovementData[] = stockLines.map((line) => ({
          productId: line.productId,
          warehouseId: warehouseId as string,
          targetWarehouseId: null,
          type: StockMovementType.In,
          quantity: line.quantity,
          // Le prix d'achat de la ligne devient le coût du mouvement.
          unitCost: line.unitPrice,
          reference: order.number,
          notes: `Réception ${order.number} — ${line.description}`,
          performedBy: actor.userId,
          performedAt,
        }));

        await this.stockWriter.write(movements, newLevels);
      }
    }

    return this.orderRepository.update(orderId, {
      status: OrderStatus.Delivered,
      deliveredAt: new Date(),
      warehouseId,
    });
  }

  /** L'entrepôt de réception doit être fourni, exister et être actif. */
  private async resolveWarehouse(warehouseId?: string): Promise<string> {
    if (warehouseId === undefined) {
      throw new BusinessRuleViolationException(
        'Cette commande contient des produits stockés : précisez ' +
          "l'entrepôt de réception (warehouseId).",
      );
    }
    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }
    if (!warehouse.isActive) {
      throw new BusinessRuleViolationException(
        `L'entrepôt ${warehouse.code} est désactivé : aucun mouvement possible.`,
      );
    }
    return warehouse.id;
  }
}
```

### ➕ Créer `src/modules/orders/application/cancel-order.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { StockMovementType } from '../../stock/domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../../stock/domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../../stock/domain/stock-level-repository.port';
import { STOCK_WRITER } from '../../stock/domain/stock-writer.port';
import type {
  NewStockMovementData,
  StockLevelWrite,
  StockWriterPort,
} from '../../stock/domain/stock-writer.port';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';
import { CollectStockLinesHelper } from './collect-stock-lines.helper';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/**
 * Cas d'utilisation : annuler une commande.
 *
 * Autorisé depuis tout statut SAUF DELIVERED (une commande livrée se
 * traite par avoir, module 07) et CANCELLED (déjà annulée).
 *
 * L'ÉCRITURE COMPENSATRICE : si une commande CLIENT était partie en
 * livraison, son stock est déjà sorti — on ne « supprime » pas les
 * mouvements (journal immuable), on écrit les mouvements INVERSES
 * (IN, référence ANNULATION CMD-XXXX). L'historique raconte toute
 * l'histoire : sorti, puis réinjecté.
 */
@Injectable()
export class CancelOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly collectStockLinesHelper: CollectStockLinesHelper,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(actor: AuthenticatedUser, orderId: string): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isCancellable()) {
      throw new BusinessRuleViolationException(
        order.status === OrderStatus.Delivered
          ? 'Une commande livrée ne peut plus être annulée (un avoir ' +
            'sera possible au module 07).'
          : 'Cette commande est déjà annulée.',
      );
    }

    // Réinjection : uniquement si le stock était réellement sorti
    // (commande CLIENT partie en livraison).
    if (order.type === OrderType.Customer && order.isInProgress()) {
      const stockLines = await this.collectStockLinesHelper.collect(order);

      if (stockLines.length > 0) {
        // Posé au départ en livraison — ne peut pas être null si des
        // lignes stockées existent.
        const warehouseId = order.warehouseId as string;

        const needed = this.collectStockLinesHelper.aggregateByProduct(
          stockLines,
        );
        const newLevels: StockLevelWrite[] = [];
        for (const [productId, quantity] of needed) {
          const level = await this.stockLevelRepository.findOne(
            productId,
            warehouseId,
          );
          newLevels.push({
            productId,
            warehouseId,
            quantity: (level?.quantity ?? 0) + quantity,
          });
        }

        const performedAt = new Date();
        const movements: NewStockMovementData[] = stockLines.map((line) => ({
          productId: line.productId,
          warehouseId,
          targetWarehouseId: null,
          type: StockMovementType.In,
          quantity: line.quantity,
          unitCost: null,
          reference: `ANNULATION ${order.number}`,
          notes: `Réinjection suite à l'annulation de ${order.number} — ${line.description}`,
          performedBy: actor.userId,
          performedAt,
        }));

        await this.stockWriter.write(movements, newLevels);
      }
    }

    return this.orderRepository.update(orderId, {
      status: OrderStatus.Cancelled,
    });
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 8 — Les DTOs

> Crée le dossier `src/modules/orders/presentation/dto/`.

### ➕ Créer `src/modules/orders/presentation/dto/order-line-input.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Une ligne du corps de création/modification de commande — même
 * dualité qu'au module 05 : ligne PRODUIT (contenu copié du catalogue
 * si absent) ou ligne LIBRE (description + prix obligatoires).
 */
export class OrderLineInputDto {
  @ApiPropertyOptional({
    description: 'Produit du catalogue ; absent = ligne libre.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId?: string;

  @ApiPropertyOptional({
    description: 'Obligatoire pour une ligne libre ; sinon copiée du produit.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La description ne peut pas être vide.' })
  @MaxLength(500, {
    message: 'La description ne peut pas dépasser 500 caractères.',
  })
  description?: string;

  @ApiProperty({
    description:
      'Quantité. ENTIÈRE pour un produit stocké (le stock compte en ' +
      'unités) ; décimales possibles pour services et lignes libres.',
    example: 2,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La quantité doit être un nombre (2 décimales max).' },
  )
  @IsPositive({ message: 'La quantité doit être strictement positive.' })
  quantity!: number;

  @ApiPropertyOptional({
    description:
      'Prix unitaire HT en EUR. Obligatoire pour une ligne libre ; ' +
      'sinon copié du produit.',
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le prix unitaire doit être un nombre (2 décimales max).' },
  )
  @Min(0, { message: 'Le prix unitaire ne peut pas être négatif.' })
  unitPrice?: number;

  @ApiPropertyOptional({
    description: 'Taux de TVA en % ; sinon copié du produit (défaut 20).',
    enum: [0, 5.5, 10, 20],
  })
  @IsOptional()
  @IsIn([0, 5.5, 10, 20], {
    message: 'Le taux de TVA doit valoir 0, 5.5, 10 ou 20.',
  })
  vatRate?: number;
}
```

### ➕ Créer `src/modules/orders/presentation/dto/create-order.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OrderType } from '../../domain/order-type.enum';
import { OrderLineInputDto } from './order-line-input.dto';

/** Corps de POST /orders. */
export class CreateOrderDto {
  @ApiProperty({
    description: 'CUSTOMER = un client nous commande ; SUPPLIER = nous commandons.',
    enum: OrderType,
    example: OrderType.Customer,
  })
  @IsEnum(OrderType, {
    message: 'Le type doit valoir CUSTOMER ou SUPPLIER.',
  })
  type!: OrderType;

  @ApiProperty({
    description:
      'Contact — client (CUSTOMER/BOTH) ou fournisseur (SUPPLIER/BOTH) ' +
      'selon le type de commande.',
  })
  @IsUUID(undefined, {
    message: 'Le contactId doit être un UUID valide.',
  })
  contactId!: string;

  @ApiPropertyOptional({ example: 'Livraison souhaitée avant fin de mois.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Date de livraison prévue (ISO 8601).',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La date de livraison prévue doit être une date ISO.' },
  )
  expectedDeliveryDate?: string;

  @ApiProperty({
    description: 'Lignes de la commande (au moins une).',
    type: [OrderLineInputDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Une commande doit contenir au moins une ligne.',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderLineInputDto)
  lines!: OrderLineInputDto[];
}
```

### ➕ Créer `src/modules/orders/presentation/dto/update-order.dto.ts`

```typescript
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

/**
 * Corps de PATCH /orders/:id (DRAFT ou CONFIRMED).
 * OmitType retire `type` : le SENS d'une commande ne change jamais
 * après création (une commande client ne devient pas fournisseur).
 * Si `lines` est fourni : remplacement complet + totaux recalculés.
 */
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['type'] as const),
) {}
```

### ➕ Créer `src/modules/orders/presentation/dto/start-delivery.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Corps (optionnel) de POST /orders/:id/start. */
export class StartDeliveryDto {
  @ApiPropertyOptional({
    description:
      'Entrepôt de SORTIE du stock — obligatoire si la commande ' +
      '(CUSTOMER) contient des produits stockés.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId?: string;
}
```

### ➕ Créer `src/modules/orders/presentation/dto/complete-order.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Corps (optionnel) de POST /orders/:id/complete. */
export class CompleteOrderDto {
  @ApiPropertyOptional({
    description:
      'Entrepôt de RÉCEPTION du stock — obligatoire si la commande ' +
      '(SUPPLIER) contient des produits stockés.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId?: string;
}
```

### ➕ Créer `src/modules/orders/presentation/dto/list-orders-query.dto.ts`

```typescript
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';

/**
 * Query string de GET /orders — pagination + plage de dates (from/to
 * sur la date de création) via IntersectionType, comme aux modules
 * 04 et 05.
 */
export class ListOrdersQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ enum: OrderType })
  @IsOptional()
  @IsEnum(OrderType, {
    message: 'Le type doit valoir CUSTOMER ou SUPPLIER.',
  })
  type?: OrderType;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus, {
    message:
      'Le statut doit valoir DRAFT, CONFIRMED, IN_PROGRESS, DELIVERED ' +
      'ou CANCELLED.',
  })
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Filtre par contact.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "contactId" doit être un UUID valide.',
  })
  contactId?: string;
}
```

### ➕ Créer `src/modules/orders/presentation/dto/order-line-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { OrderLine } from '../../domain/order-line';

/** Représentation publique d'une ligne de commande. */
export class OrderLineResponseDto {
  @ApiProperty({ description: 'Identifiant de la ligne (UUID).' })
  id!: string;

  @ApiProperty({ nullable: true, description: 'null = ligne libre.' })
  productId!: string | null;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  description!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ description: 'Prix unitaire HT figé.', example: 349.9 })
  unitPrice!: number;

  @ApiProperty({ example: 20 })
  vatRate!: number;

  @ApiProperty({ description: 'qté × prix, au centime.', example: 699.8 })
  subtotalHT!: number;

  static fromDomain(line: OrderLine): OrderLineResponseDto {
    const dto = new OrderLineResponseDto();
    dto.id = line.id;
    dto.productId = line.productId;
    dto.description = line.description;
    dto.quantity = line.quantity;
    dto.unitPrice = line.unitPrice;
    dto.vatRate = line.vatRate;
    dto.subtotalHT = line.subtotalHT;
    return dto;
  }
}
```

### ➕ Créer `src/modules/orders/presentation/dto/order-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../../domain/order';
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';
import { OrderLineResponseDto } from './order-line-response.dto';

/**
 * Représentation publique d'une commande.
 * Dans les listes, `lines` est un tableau vide (le détail les charge).
 */
export class OrderResponseDto {
  @ApiProperty({ description: 'Identifiant de la commande (UUID).' })
  id!: string;

  @ApiProperty({ example: 'CMD-2026-0001' })
  number!: string;

  @ApiProperty({ enum: OrderType })
  type!: OrderType;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty()
  contactId!: string;

  @ApiProperty({ example: 'ACME Industries' })
  contactName!: string;

  @ApiProperty({
    nullable: true,
    description: 'Devis d’origine si la commande vient d’une conversion.',
  })
  quoteId!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Entrepôt de livraison/réception (posé par les transitions).',
  })
  warehouseId!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: [OrderLineResponseDto] })
  lines!: OrderLineResponseDto[];

  @ApiProperty({ example: 699.8 })
  totalHT!: number;

  @ApiProperty({ example: 139.96 })
  totalVAT!: number;

  @ApiProperty({ example: 839.76 })
  totalTTC!: number;

  @ApiProperty({ nullable: true })
  expectedDeliveryDate!: Date | null;

  @ApiProperty({ nullable: true, description: 'Posée à la clôture.' })
  deliveredAt!: Date | null;

  @ApiProperty({ nullable: true, description: 'UUID du créateur.' })
  createdBy!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(order: Order): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.number = order.number;
    dto.type = order.type;
    dto.status = order.status;
    dto.contactId = order.contactId;
    dto.contactName = order.contactName;
    dto.quoteId = order.quoteId;
    dto.warehouseId = order.warehouseId;
    dto.notes = order.notes;
    dto.lines = order.lines.map(OrderLineResponseDto.fromDomain);
    dto.totalHT = order.totalHT;
    dto.totalVAT = order.totalVAT;
    dto.totalTTC = order.totalTTC;
    dto.expectedDeliveryDate = order.expectedDeliveryDate;
    dto.deliveredAt = order.deliveredAt;
    dto.createdBy = order.createdBy;
    dto.createdAt = order.createdAt;
    dto.updatedAt = order.updatedAt;
    return dto;
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 9 — Le contrôleur

### ➕ Créer `src/modules/orders/presentation/orders.controller.ts`

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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { CancelOrderUseCase } from '../application/cancel-order.use-case';
import { CompleteOrderUseCase } from '../application/complete-order.use-case';
import { ConfirmOrderUseCase } from '../application/confirm-order.use-case';
import { CreateOrderUseCase } from '../application/create-order.use-case';
import { DeleteOrderUseCase } from '../application/delete-order.use-case';
import { GetOrderByIdUseCase } from '../application/get-order-by-id.use-case';
import { ListOrdersUseCase } from '../application/list-orders.use-case';
import { StartDeliveryUseCase } from '../application/start-delivery.use-case';
import { UpdateOrderUseCase } from '../application/update-order.use-case';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { StartDeliveryDto } from './dto/start-delivery.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

/**
 * Contrôleur des commandes (clients et fournisseurs).
 * start/complete sont ouverts à tous les rôles : ce sont les gestes
 * du quotidien d'un magasinier.
 */
@ApiTags('Commandes')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly listOrdersUseCase: ListOrdersUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly updateOrderUseCase: UpdateOrderUseCase,
    private readonly deleteOrderUseCase: DeleteOrderUseCase,
    private readonly confirmOrderUseCase: ConfirmOrderUseCase,
    private readonly startDeliveryUseCase: StartDeliveryUseCase,
    private readonly completeOrderUseCase: CompleteOrderUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des commandes',
    description:
      'Filtres : type, status, contactId, from/to (création, ISO), ' +
      'search (numéro / nom du contact).',
  })
  @ApiOkResponse({ type: [OrderResponseDto] })
  async list(
    @Query() query: ListOrdersQueryDto,
  ): Promise<PaginatedResult<OrderResponseDto>> {
    const result = await this.listOrdersUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      type: query.type,
      status: query.status,
      contactId: query.contactId,
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(OrderResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une commande (avec ses lignes)" })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Commande inconnue.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    const order = await this.getOrderByIdUseCase.execute(id);
    return OrderResponseDto.fromDomain(order);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Créer une commande (statut DRAFT)',
    description:
      'Numéro auto : CMD-YYYY-NNNN (client) ou CDF-YYYY-NNNN ' +
      '(fournisseur). Totaux calculés côté serveur.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Contact ou produit inconnu.' })
  @ApiConflictResponse({
    description:
      'Contact incompatible avec le type, produit désactivé ou ligne ' +
      'libre incomplète.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.createOrderUseCase.execute(user, body);
    return OrderResponseDto.fromDomain(order);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Modifier une commande (DRAFT ou CONFIRMED)',
    description: 'Si `lines` est fourni : remplacement complet + recalcul.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Commande inconnue.' })
  @ApiConflictResponse({ description: 'Commande non modifiable.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.updateOrderUseCase.execute(id, body);
    return OrderResponseDto.fromDomain(order);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une commande (DRAFT uniquement)',
    description: 'Au-delà du brouillon : utiliser l’annulation.',
  })
  @ApiNoContentResponse({ description: 'Commande supprimée.' })
  @ApiConflictResponse({ description: 'Commande non supprimable.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteOrderUseCase.execute(id);
  }

  @Post(':id/confirm')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmer (DRAFT → CONFIRMED)' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async confirm(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    const order = await this.confirmOrderUseCase.execute(id);
    return OrderResponseDto.fromDomain(order);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Départ en livraison (CONFIRMED → IN_PROGRESS)',
    description:
      'Commande CLIENT : sort le stock de l’entrepôt indiqué ' +
      '(warehouseId obligatoire si produits stockés) — 409 si stock ' +
      'insuffisant, rien ne bouge.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiConflictResponse({
    description:
      'Transition invalide, entrepôt manquant/désactivé ou stock ' +
      'insuffisant.',
  })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StartDeliveryDto,
  ): Promise<OrderResponseDto> {
    const order = await this.startDeliveryUseCase.execute(user, id, body);
    return OrderResponseDto.fromDomain(order);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clôturer la livraison (IN_PROGRESS → DELIVERED)',
    description:
      'Commande FOURNISSEUR : fait entrer le stock dans l’entrepôt ' +
      'indiqué (warehouseId obligatoire si produits stockés), avec le ' +
      'prix d’achat comme coût du mouvement. Pose deliveredAt.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiConflictResponse({
    description: 'Transition invalide ou entrepôt manquant/désactivé.',
  })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CompleteOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.completeOrderUseCase.execute(user, id, body);
    return OrderResponseDto.fromDomain(order);
  }

  @Post(':id/cancel')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Annuler une commande',
    description:
      'Possible depuis tout statut sauf DELIVERED. Si la commande ' +
      '(CLIENT) était partie en livraison : le stock sorti est ' +
      'réinjecté (mouvements ANNULATION CMD-XXXX).',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiConflictResponse({
    description: 'Commande livrée ou déjà annulée.',
  })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    const order = await this.cancelOrderUseCase.execute(user, id);
    return OrderResponseDto.fromDomain(order);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 10 — Le module + AppModule (+ une retouche au module 04)

### ✏️ Modifier `src/modules/stock/stock.module.ts` — exporter le repository entrepôts

Les use cases de livraison valident l'entrepôt fourni : ils ont besoin du `WAREHOUSE_REPOSITORY`. Dans le tableau `exports` du `StockModule` :

**AVANT** :

```typescript
  exports: [STOCK_LEVEL_REPOSITORY, STOCK_WRITER],
```

**APRÈS** :

```typescript
  // WAREHOUSE_REPOSITORY : le module commandes (06) valide l'entrepôt
  // de livraison/réception avant de mouvementer le stock.
  exports: [STOCK_LEVEL_REPOSITORY, STOCK_WRITER, WAREHOUSE_REPOSITORY],
```

> 💡 Si ton `stock.module.ts` exporte déjà `WAREHOUSE_REPOSITORY` (version à jour du guide 04), il n'y a rien à faire. Vérifie que l'import du symbole est présent en tête de fichier.

### ➕ Créer `src/modules/orders/orders.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { ContactsModule } from '../contacts/contacts.module';
import { StockModule } from '../stock/stock.module';
import { CancelOrderUseCase } from './application/cancel-order.use-case';
import { CollectStockLinesHelper } from './application/collect-stock-lines.helper';
import { CompleteOrderUseCase } from './application/complete-order.use-case';
import { ConfirmOrderUseCase } from './application/confirm-order.use-case';
import { CreateOrderUseCase } from './application/create-order.use-case';
import { DeleteOrderUseCase } from './application/delete-order.use-case';
import { GetOrderByIdUseCase } from './application/get-order-by-id.use-case';
import { ListOrdersUseCase } from './application/list-orders.use-case';
import { ResolveOrderLinesHelper } from './application/resolve-order-lines.helper';
import { StartDeliveryUseCase } from './application/start-delivery.use-case';
import { UpdateOrderUseCase } from './application/update-order.use-case';
import { ORDER_REPOSITORY } from './domain/order-repository.port';
import { OrderEntity } from './infrastructure/entities/order.entity';
import { OrderLineEntity } from './infrastructure/entities/order-line.entity';
import { OrderMapper } from './infrastructure/order.mapper';
import { TypeOrmOrderRepository } from './infrastructure/typeorm-order.repository';
import { OrdersController } from './presentation/orders.controller';

/**
 * Module des commandes (clients et fournisseurs).
 *
 * Imports : Contacts (validation du contact), Catalogue (résolution
 * des lignes), Stock (writer atomique + niveaux + entrepôts pour la
 * logistique), Database (remplacement transactionnel des lignes).
 *
 * ⚠️ N'importe PAS QuotesModule (c'est QuotesModule qui importera
 * OrdersModule pour la conversion — l'inverse créerait un cycle).
 * La FK orders.quote_id passe par l'entité seule.
 *
 * Exports : ORDER_REPOSITORY + CreateOrderUseCase (conversion de devis,
 * étape 11) + GetOrderByIdUseCase (module 07, facturation).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderLineEntity]),
    ContactsModule,
    CatalogueModule,
    StockModule,
    DatabaseModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrderMapper,
    ResolveOrderLinesHelper,
    CollectStockLinesHelper,
    ListOrdersUseCase,
    GetOrderByIdUseCase,
    CreateOrderUseCase,
    UpdateOrderUseCase,
    DeleteOrderUseCase,
    ConfirmOrderUseCase,
    StartDeliveryUseCase,
    CompleteOrderUseCase,
    CancelOrderUseCase,
    {
      provide: ORDER_REPOSITORY,
      useClass: TypeOrmOrderRepository,
    },
  ],
  exports: [ORDER_REPOSITORY, CreateOrderUseCase, GetOrderByIdUseCase],
})
export class OrdersModule {}
```

### ✏️ Modifier `src/app.module.ts`

**1)** Ajoute l'import :

```typescript
import { OrdersModule } from './modules/orders/orders.module';
```

**2)** Dans le tableau `imports`, après `QuotesModule` :

```typescript
    StockModule,
    QuotesModule,
    OrdersModule,
    AuthenticationModule,
```

**✅ Point de contrôle** : `npm run build` puis `npm run start:dev` — les 9 routes `/api/v1/orders*` apparaissent.

---

## Étape 11 — La conversion devis → commande

La promesse du module 05 se tient ici : `POST /quotes/:id/convert`. Le use case vit dans le module DEVIS (c'est une action sur un devis), qui importe le module COMMANDES (jamais l'inverse : pas de cycle).

### ➕ Créer `src/modules/quotes/application/convert-quote-to-order.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { roundMoney } from '../../../common/money/money';
import { CreateOrderUseCase } from '../../orders/application/create-order.use-case';
import { Order } from '../../orders/domain/order';
import { ORDER_REPOSITORY } from '../../orders/domain/order-repository.port';
import type { OrderRepositoryPort } from '../../orders/domain/order-repository.port';
import { OrderType } from '../../orders/domain/order-type.enum';
import { QuoteStatus } from '../domain/quote-status.enum';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';

/**
 * Cas d'utilisation : convertir un devis ACCEPTÉ en commande client.
 *
 * Règles :
 *   - le devis doit être ACCEPTED (409 sinon) ;
 *   - un devis ne se convertit qu'UNE fois (la commande porte quoteId) ;
 *   - les lignes sont copiées avec la remise FONDUE dans le prix
 *     unitaire (une ligne de commande n'a pas de colonne remise) —
 *     prix ligne = prix devis × (1 - remise/100), au centime ;
 *   - le devis RESTE en statut ACCEPTED (il n'a pas de statut
 *     « converti » : c'est la commande qui trace le lien).
 */
@Injectable()
export class ConvertQuoteToOrderUseCase {
  constructor(
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly createOrderUseCase: CreateOrderUseCase,
  ) {}

  async execute(actor: AuthenticatedUser, quoteId: string): Promise<Order> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);

    if (quote.status !== QuoteStatus.Accepted) {
      throw new BusinessRuleViolationException(
        `Seul un devis accepté peut être converti en commande (statut ` +
          `actuel : ${quote.status}).`,
      );
    }

    if (await this.orderRepository.existsForQuote(quoteId)) {
      throw new BusinessRuleViolationException(
        `Le devis ${quote.number} a déjà été converti en commande.`,
      );
    }

    return this.createOrderUseCase.execute(actor, {
      type: OrderType.Customer,
      contactId: quote.customerId,
      notes: quote.notes ?? undefined,
      quoteId: quote.id,
      lines: quote.lines.map((line) => ({
        productId: line.productId ?? undefined,
        description: line.description,
        quantity: line.quantity,
        // Remise fondue dans le prix : les totaux de la commande
        // peuvent différer du devis d'un centime dans de rares cas
        // d'arrondi — c'est le prix FONDU qui fait foi.
        unitPrice: roundMoney(
          line.unitPrice * (1 - line.discountPercent / 100),
        ),
        vatRate: line.vatRate,
      })),
    });
  }
}
```

### ✏️ Modifier `src/modules/quotes/presentation/quotes.controller.ts`

**1)** Ajoute les imports :

```typescript
import { ConvertQuoteToOrderUseCase } from '../application/convert-quote-to-order.use-case';
import { OrderResponseDto } from '../../orders/presentation/dto/order-response.dto';
```

**2)** Ajoute le use case au constructeur :

```typescript
    private readonly convertQuoteToOrderUseCase: ConvertQuoteToOrderUseCase,
```

**3)** Ajoute la route à la fin de la classe (après `reject`) :

```typescript
  @Post(':id/convert')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Convertir un devis accepté en commande client',
    description:
      'Copie les lignes (remise fondue dans le prix unitaire), trace ' +
      'quoteId sur la commande. Un devis ne se convertit qu’une fois.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiConflictResponse({
    description: 'Devis non accepté, ou déjà converti.',
  })
  async convert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    const order = await this.convertQuoteToOrderUseCase.execute(user, id);
    return OrderResponseDto.fromDomain(order);
  }
```

> 📌 Le POST garde ici son 201 par défaut : contrairement à send/accept/reject, cette route CRÉE une ressource (la commande).

### ✏️ Modifier `src/modules/quotes/quotes.module.ts`

**1)** Ajoute les imports :

```typescript
import { OrdersModule } from '../orders/orders.module';
import { ConvertQuoteToOrderUseCase } from './application/convert-quote-to-order.use-case';
```

**2)** Ajoute `OrdersModule` au tableau `imports` et le use case aux `providers` :

```typescript
  imports: [
    TypeOrmModule.forFeature([QuoteEntity, QuoteLineEntity]),
    ContactsModule,
    CatalogueModule,
    DatabaseModule,
    // Conversion devis -> commande. Sens UNIQUE : OrdersModule
    // n'importe jamais QuotesModule (cycle interdit).
    OrdersModule,
  ],
```

```typescript
    RejectQuoteUseCase,
    ConvertQuoteToOrderUseCase,
```

**✅ Point de contrôle** : `npm run build` puis `npm run start:dev` — la route `POST /api/v1/quotes/:id/convert` apparaît dans la section « Devis » de Swagger.

---

## Étape 12 — Vérifier que ça marche & ce qu'on verra plus tard

### 12.1 Parcours manuel (PowerShell)

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion + prérequis : client, fournisseur, produit, entrepôt
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

$client = Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"type":"CUSTOMER","companyName":"ACME Industries"}'
$fourn = Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"type":"SUPPLIER","companyName":"Grossiste Écrans SARL"}'
$prod = Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Écran Dell 27\" QHD","type":"PRODUCT","unit":"UNIT","unitPrice":349.90,"purchasePrice":220}'
$wh = Invoke-RestMethod -Method Post -Uri "$base/warehouses" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Entrepôt Paris Nord","code":"WH-PARIS"}'

# 2. FLUX FOURNISSEUR : on commande 10 écrans (CDF-...)
$cdf = Invoke-RestMethod -Method Post -Uri "$base/orders" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"type":"SUPPLIER","contactId":"' + $fourn.data.id + '",' +
         '"lines":[{"productId":"' + $prod.data.id + '","quantity":10,"unitPrice":220}]}')
$cdf.data.number   # → CDF-2026-0001 (séquence fournisseur)

Invoke-RestMethod -Method Post -Uri "$base/orders/$($cdf.data.id)/confirm" -Headers $headers | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cdf.data.id)/start" -Headers $headers `
  -ContentType 'application/json' -Body '{}' | Out-Null
# 3. Réception : le stock ENTRE (avec 220 comme coût du mouvement)
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cdf.data.id)/complete" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"warehouseId":"' + $wh.data.id + '"}') | Out-Null
(Invoke-RestMethod -Uri "$base/stock" -Headers $headers).data[0].quantity   # → 10

# 4. FLUX CLIENT : commande de 2 écrans (CMD-...)
$cmd = Invoke-RestMethod -Method Post -Uri "$base/orders" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"type":"CUSTOMER","contactId":"' + $client.data.id + '",' +
         '"lines":[{"productId":"' + $prod.data.id + '","quantity":2}]}')
$cmd.data.number   # → CMD-2026-0001 (séquence indépendante)

Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd.data.id)/confirm" -Headers $headers | Out-Null

# 5. Départ en livraison SANS préciser l'entrepôt → 409, message clair
try {
  Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd.data.id)/start" `
    -Headers $headers -ContentType 'application/json' -Body '{}'
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 6. Départ en livraison : le stock SORT (10 → 8)
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd.data.id)/start" -Headers $headers `
  -ContentType 'application/json' -Body ('{"warehouseId":"' + $wh.data.id + '"}') | Out-Null
(Invoke-RestMethod -Uri "$base/stock" -Headers $headers).data[0].quantity   # → 8

# 7. Clôture : DELIVERED, deliveredAt posé
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd.data.id)/complete" -Headers $headers `
  -ContentType 'application/json' -Body '{}' | ConvertTo-Json -Depth 5

# 8. L'ANNULATION COMPENSATRICE : une commande de 3, partie en livraison...
$cmd2 = Invoke-RestMethod -Method Post -Uri "$base/orders" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"type":"CUSTOMER","contactId":"' + $client.data.id + '",' +
         '"lines":[{"productId":"' + $prod.data.id + '","quantity":3}]}')
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd2.data.id)/confirm" -Headers $headers | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd2.data.id)/start" -Headers $headers `
  -ContentType 'application/json' -Body ('{"warehouseId":"' + $wh.data.id + '"}') | Out-Null
(Invoke-RestMethod -Uri "$base/stock" -Headers $headers).data[0].quantity   # → 5

# ... puis annulée : le stock revient (5 → 8)
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd2.data.id)/cancel" -Headers $headers | Out-Null
(Invoke-RestMethod -Uri "$base/stock" -Headers $headers).data[0].quantity   # → 8

# 9. L'historique raconte tout : cherche les mouvements ANNULATION
Invoke-RestMethod -Uri "$base/stock/movements?search=ANNULATION" -Headers $headers |
  ConvertTo-Json -Depth 5

# 10. LA BOUCLE COMPLÈTE : devis → accepté → converti en commande
$quote = Invoke-RestMethod -Method Post -Uri "$base/quotes" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"customerId":"' + $client.data.id + '",' +
         '"lines":[{"productId":"' + $prod.data.id + '","quantity":2,"discountPercent":10}]}')
Invoke-RestMethod -Method Post -Uri "$base/quotes/$($quote.data.id)/send" -Headers $headers | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/quotes/$($quote.data.id)/accept" -Headers $headers | Out-Null
$converted = Invoke-RestMethod -Method Post -Uri "$base/quotes/$($quote.data.id)/convert" -Headers $headers
$converted.data.number                  # → CMD-2026-0003
$converted.data.quoteId                 # → l'id du devis (traçabilité)
$converted.data.lines[0].unitPrice      # → 314.91 (349.90 × 0.9 : remise fondue)

# 11. Double conversion → 409
try {
  Invoke-RestMethod -Method Post -Uri "$base/quotes/$($quote.data.id)/convert" -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}
```

Même parcours possible à la souris dans **Swagger**.

### 12.2 Les pièges croisés en route (mémo)

| Piège | Parade |
|---|---|
| Deux lignes du même produit passent le contrôle de stock une par une | Agrégation `Map<productId, quantité>` AVANT vérification |
| « Annuler » des mouvements de stock | Jamais : écriture COMPENSATRICE (IN, référence `ANNULATION CMD-XXXX`) |
| Où réinjecter le stock à l'annulation ? | `order.warehouseId`, mémorisé au départ en livraison |
| 2.5 unités d'un produit stocké (le stock est en entiers) | 409 explicite au moment de la livraison |
| QuotesModule ↔ OrdersModule : dépendance circulaire | Sens unique : Quotes importe Orders ; la FK `orders.quote_id` passe par l'entité seule |
| Le type de commande changé après coup | `OmitType(CreateOrderDto, ['type'])` : le sens d'une commande est immuable |
| Remise du devis perdue à la conversion | Fondue dans le prix unitaire (`prix × (1 - remise/100)`, au centime) |
| Une seule séquence pour deux types de documents | Préfixes distincts CMD-/CDF-, chacun son MAX |

### 12.3 Ce qu'on verra plus tard (rien n'est perdu)

| Différé | Pourquoi ce n'est pas bloquant | Niveau |
|---|---|---|
| **Facturation** (`POST /orders/:id/invoice`) | Impossible avant le module 07 (les factures n'existent pas encore) | ✅ couverte par `mini-DEV-07`, étape 11 |
| **`findActiveByContact` / `findActiveByProduct`** (blocages de suppression inter-modules) | Confort d'intégrité ; le soft-delete des contacts/produits reste réversible | 🟡 min- |
| **Contact complet embarqué** (`contact: ContactResponseDto`) | `contactName` + `contactId` couvrent l'affichage courant | 🟡 min- |
| **Audit** (`orders.*`) | `createdBy` + les mouvements de stock nominatifs tracent déjà l'essentiel | 🟡 min- |
| **Tests** (unit : stock insuffisant sans effet de bord, annulation compensatrice ; e2e : les deux flux complets) | L'application fonctionne ; garantie long terme | 🔴 complet |

### 12.4 Ce que ce module t'a appris de nouveau

1. **Les transitions à effets de bord** : une machine à états qui pilote un autre module (le stock), avec toutes les vérifications AVANT la première écriture.
2. **La réutilisation d'un port exporté** : le `StockWriter` du module 04 sert tel quel — c'est exactement pour ça qu'on l'avait exporté.
3. **L'écriture compensatrice** : on n'efface jamais l'historique, on écrit l'inverse — le journal des mouvements raconte l'histoire vraie.
4. **L'agrégation avant contrôle** : vérifier ligne à ligne est un bug classique ; on agrège par produit d'abord.
5. **La composition de use cases inter-modules** : `ConvertQuoteToOrder` (module devis) orchestre `CreateOrder` (module commandes) — dépendance à sens unique, jamais de cycle.
6. **`OmitType`** : troisième outil des mapped types Swagger (après `PartialType` et `IntersectionType`) — retirer un champ immuable d'un DTO de modification.

---

*Fin du guide mini-DEV-06. Prochain module : la facturation (07) — factures générées depuis les commandes livrées, avoirs, échéances, et le premier PDF du projet.*
