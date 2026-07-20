# mini-DEV-07 · Facturation & Avoirs — l'essentiel pour démarrer

> **Spec couverte** : `specs/07-facturation-avoirs-pdf/07-facturation-avoirs-pdf.md` (version minimale)
> **Niveau** : 🟢 fonctionnel — même logique que les `mini-DEV-01` à `06` (voir `RECAP-DEV-01` pour la philosophie des 3 niveaux).
> **Prérequis** : `mini-DEV-01` à `mini-DEV-06` terminés (la facturation dépend des contacts, du catalogue et des commandes).
> **Promesse** : à la fin, des factures numérotées (`FAC-2026-NNNN`), créées à la main ou d'un clic depuis une commande livrée, avec un cycle de vie légal strict — **une facture envoyée ne se modifie plus JAMAIS : elle se corrige par un AVOIR** (`AV-2026-NNNN`), total ou partiel, lié à sa facture d'origine. Une tâche nocturne repère les impayés en retard (`OVERDUE`). 9 routes dans Swagger. Environ 3 h 30.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — Le domaine : enums, lignes, facture, totaux](#étape-1--le-domaine--enums-lignes-facture-totaux)
- [Étape 2 — Le port du repository](#étape-2--le-port-du-repository)
- [Étape 3 — Les entités TypeORM et le mapper](#étape-3--les-entités-typeorm-et-le-mapper)
- [Étape 4 — La migration](#étape-4--la-migration)
- [Étape 5 — Le repository](#étape-5--le-repository)
- [Étape 6 — Les cas d'utilisation : CRUD (6)](#étape-6--les-cas-dutilisation--crud-6)
- [Étape 7 — Les cas d'utilisation : transitions, avoir & cron (4 + 1 tâche)](#étape-7--les-cas-dutilisation--transitions-avoir--cron-4--1-tâche)
- [Étape 8 — Les DTOs](#étape-8--les-dtos)
- [Étape 9 — Le contrôleur](#étape-9--le-contrôleur)
- [Étape 10 — Le module + AppModule](#étape-10--le-module--appmodule)
- [Étape 11 — La conversion commande → facture](#étape-11--la-conversion-commande--facture)
- [Étape 12 — Vérifier que ça marche & ce qu'on verra plus tard](#étape-12--vérifier-que-ça-marche--ce-quon-verra-plus-tard)

---

## 0 · Avant de commencer

- API démarrée, base à jour, tables des modules 02 à 06 présentes.
- Pour les rappels sur le socle : section A de `mini-DEV-01`.

### Les nouveautés de ce module

1. **Le document légal.** Un devis refusé se jette, une commande s'annule… une facture ENVOYÉE, elle, ne se modifie ni ne se supprime JAMAIS (obligation comptable). La seule correction possible est un document inverse : l'avoir. Toute la conception découle de cette règle.
2. **L'auto-référence de table.** Un avoir EST une facture (type `CREDIT_NOTE`) qui pointe vers la facture qu'elle corrige : la colonne `credit_note_for_id` référence… la table `invoices` elle-même. Deuxième self-join du projet (après les catégories du module 03).
3. **Deux séquences dans une table.** `FAC-2026-NNNN` pour les factures, `AV-2026-NNNN` pour les avoirs — même mécanique `MAX` qu'aux modules 05/06, le préfixe dépend du TYPE.
4. **Un statut piloté par un AUTRE module.** `PARTIALLY_PAID` et `PAID` existent dès maintenant dans l'enum, mais RIEN dans ce module ne les pose : c'est le module 08 (paiements) qui fera vivre `paidAmount`. Concevoir une machine à états dont certains états appartiennent au futur, c'est ça, un monolithe modulaire.
5. **La conversion commande → facture** : même pattern qu'au module 06 (devis → commande), sens de dépendance unique, double facturation interdite.

**Choix assumés de cette version** (comme au module 05) : le PDF, son stockage et l'e-mail au client sont différés — « envoyer » ne fait que la transition `DRAFT → SENT`. La colonne `pdf_url` est DÉJÀ en base (aucune migration au min-), simplement toujours nulle. Détail au § final.

**Convention des montants d'avoir** : un avoir stocke ses montants en POSITIF — c'est son TYPE qui porte le sens. `totalTTC = 100` sur un `CREDIT_NOTE` signifie « 100 € en faveur du client ». Le module 08 fera la soustraction. (La spec laissait le choix ; le positif évite de disséminer des `-` dans tous les calculs.)

---

## B · Ce qu'on va construire

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/invoices` | tout connecté | Liste paginée ; filtres `type`, `status`, `customerId`, `from`, `to`, `search` |
| `GET /api/v1/invoices/:id` | tout connecté | Détail avec lignes, nom du client, reste à payer |
| `POST /api/v1/invoices` | ADMIN, MANAGER | Créer manuellement (DRAFT, numéro `FAC-`, échéance +30 j par défaut) |
| `PATCH /api/v1/invoices/:id` | ADMIN, MANAGER | Modifier — **DRAFT uniquement** |
| `DELETE /api/v1/invoices/:id` | ADMIN | Supprimer — **DRAFT uniquement** (204) |
| `POST /api/v1/invoices/:id/send` | ADMIN, MANAGER | DRAFT → SENT (le point de non-retour) |
| `POST /api/v1/invoices/:id/cancel` | ADMIN, MANAGER | DRAFT/SENT → CANCELLED |
| `POST /api/v1/invoices/:id/credit-note` | ADMIN, MANAGER | Créer un AVOIR depuis une facture émise (201) |
| `POST /api/v1/orders/:id/invoice` | ADMIN, MANAGER | Facturer une commande client LIVRÉE (201) |

**Le cycle de vie** :

```
DRAFT ──send──▶ SENT ──(module 08)──▶ PARTIALLY_PAID ──▶ PAID
  │               │──(cron 02:00)──▶ OVERDUE
  └────cancel─────┘        (payée, même partiellement : on ne peut
                            plus annuler — on crée un AVOIR)
```

**Les règles métier incluses** :

- le client doit être un contact `CUSTOMER` ou `BOTH` ;
- échéance par défaut : émission + 30 jours ; une échéance antérieure à l'émission est refusée ;
- totaux HT/TVA/TTC calculés côté serveur (`roundMoney`, comme aux modules 05/06) ; `paidAmount` démarre à 0 et n'appartient qu'au module 08 ;
- modification et suppression : `DRAFT` uniquement ; annulation : `DRAFT` ou `SENT` uniquement — payée même partiellement, la sortie est l'avoir ;
- avoir : uniquement depuis une facture émise (`SENT`, `OVERDUE`, `PARTIALLY_PAID`, `PAID`), jamais depuis un brouillon ni depuis un autre avoir ; lignes copiées de la source si non fournies (avoir total), fournies pour un avoir partiel ;
- facturation d'une commande : `CUSTOMER` + `DELIVERED` uniquement, une seule fois ;
- chaque nuit à 2 h, les factures `SENT`/`PARTIALLY_PAID` à échéance dépassée passent `OVERDUE`.

**31 fichiers créés, 3 modifiés** (`app.module.ts`, `orders.module.ts` et le contrôleur des commandes pour la facturation), **1 migration générée**.

---

## Étape 1 — Le domaine : enums, lignes, facture, totaux

> Crée l'arborescence `src/modules/invoices/domain/`.

### ➕ Créer `src/modules/invoices/domain/invoice-type.enum.ts`

```typescript
/**
 * Nature du document.
 *
 * INVOICE     : facture — le client nous doit le montant.
 * CREDIT_NOTE : avoir — nous devons le montant au client. Ses montants
 *               sont stockés en POSITIF : c'est le type qui porte le
 *               sens (le module 08 fera la soustraction).
 */
export enum InvoiceType {
  Invoice = 'INVOICE',
  CreditNote = 'CREDIT_NOTE',
}
```

### ➕ Créer `src/modules/invoices/domain/invoice-status.enum.ts`

```typescript
/**
 * Cycle de vie d'une facture. Transitions AUTORISÉES :
 *
 *   DRAFT ──send──▶ SENT ──(paiements, module 08)──▶ PARTIALLY_PAID / PAID
 *     │               │──(cron quotidien)──▶ OVERDUE
 *     └────cancel─────┘
 *
 * PARTIALLY_PAID et PAID existent dès maintenant mais ne sont posés
 * par RIEN dans ce module : ils appartiennent au module 08 (paidAmount
 * est sa propriété exclusive).
 *
 * RÈGLE D'OR : une facture SENT ne se modifie plus jamais. Payée même
 * partiellement, elle ne s'annule plus non plus — on crée un AVOIR.
 */
export enum InvoiceStatus {
  Draft = 'DRAFT',
  Sent = 'SENT',
  PartiallyPaid = 'PARTIALLY_PAID',
  Paid = 'PAID',
  Overdue = 'OVERDUE',
  Cancelled = 'CANCELLED',
}
```

### ➕ Créer `src/modules/invoices/domain/invoice-line.ts`

```typescript
/**
 * Ligne de facture — figée à la création (modules 05/06 : un document
 * commercial copie ses données au moment T, il ne suit pas le catalogue).
 */
export class InvoiceLine {
  constructor(
    public readonly id: string,
    public readonly invoiceId: string,
    /** null = ligne libre (article hors catalogue). */
    public readonly productId: string | null,
    public readonly description: string,
    public readonly quantity: number,
    /** Prix unitaire HT en EUR, figé. */
    public readonly unitPrice: number,
    /** Taux de TVA en % (0, 5.5, 10, 20), figé. */
    public readonly vatRate: number,
    /** quantité × prix, arrondi au centime. */
    public readonly subtotalHT: number,
  ) {}
}
```

### ➕ Créer `src/modules/invoices/domain/invoice.ts`

```typescript
import { roundMoney } from '../../../common/money/money';
import { InvoiceLine } from './invoice-line';
import { InvoiceStatus } from './invoice-status.enum';
import { InvoiceType } from './invoice-type.enum';

/**
 * Facture ou avoir — agrégat racine.
 *
 * paidAmount est mis à jour EXCLUSIVEMENT par le module 08 : ici il
 * vaut toujours 0. remainingAmount est CALCULÉ, jamais stocké — une
 * donnée dérivable stockée finit toujours par diverger de sa source.
 */
export class Invoice {
  constructor(
    public readonly id: string,
    /** FAC-2026-0001 (facture) ou AV-2026-0001 (avoir), unique. */
    public readonly number: string,
    public readonly type: InvoiceType,
    public readonly customerId: string,
    /** Nom du client, dénormalisé pour l'affichage (jointure lecture). */
    public readonly customerName: string,
    /** Commande d'origine si la facture vient d'une conversion. */
    public readonly orderId: string | null,
    public readonly status: InvoiceStatus,
    public readonly issueDate: Date,
    public readonly dueDate: Date,
    public readonly totalHT: number,
    public readonly totalVAT: number,
    public readonly totalTTC: number,
    /** Propriété exclusive du module 08 — toujours 0 pour l'instant. */
    public readonly paidAmount: number,
    /** Facture corrigée par cet avoir (CREDIT_NOTE uniquement). */
    public readonly creditNoteForId: string | null,
    /** URL du PDF stocké — branché au niveau min-, null pour l'instant. */
    public readonly pdfUrl: string | null,
    public readonly notes: string | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** Vide dans les listes ; complet dans le détail. */
    public readonly lines: InvoiceLine[],
  ) {}

  /** Reste à payer : TTC - déjà payé, au centime. */
  remainingAmount(): number {
    return roundMoney(this.totalTTC - this.paidAmount);
  }

  isDraft(): boolean {
    return this.status === InvoiceStatus.Draft;
  }

  /** Annulable : brouillon ou envoyée — payée (même en partie), NON. */
  isCancellable(): boolean {
    return (
      this.status === InvoiceStatus.Draft ||
      this.status === InvoiceStatus.Sent
    );
  }

  /**
   * Peut recevoir un avoir : une FACTURE émise (envoyée, en retard ou
   * payée). Jamais un brouillon (qui se corrige directement), jamais
   * un avoir (on ne corrige pas une correction : on refacture).
   */
  isCreditable(): boolean {
    return (
      this.type === InvoiceType.Invoice &&
      (this.status === InvoiceStatus.Sent ||
        this.status === InvoiceStatus.Overdue ||
        this.status === InvoiceStatus.PartiallyPaid ||
        this.status === InvoiceStatus.Paid)
    );
  }
}
```

### ➕ Créer `src/modules/invoices/domain/invoice-totals.ts`

```typescript
import { roundMoney } from '../../../common/money/money';

/**
 * Calcul des lignes et totaux — même logique qu'aux modules 05 et 06
 * (une factorisation des trois dans common/money est une amélioration
 * de niveau min- : trois copies proches valent mieux qu'une mauvaise
 * abstraction précipitée).
 */

/** Ligne prête à calculer (contenu déjà résolu par le use case). */
export interface InvoiceLineDraft {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

/** Ligne calculée : le sous-total HT est posé. */
export interface ComputedInvoiceLine extends InvoiceLineDraft {
  subtotalHT: number;
}

/** Totaux d'une facture. */
export interface InvoiceTotals {
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

/** Pose le sous-total (qté × prix, au centime) de chaque ligne. */
export function computeInvoiceLines(
  lines: InvoiceLineDraft[],
): ComputedInvoiceLine[] {
  return lines.map((line) => ({
    ...line,
    subtotalHT: roundMoney(line.quantity * line.unitPrice),
  }));
}

/** Totaux — TVA ligne par ligne, arrondie à chaque étape. */
export function computeInvoiceTotals(
  lines: ComputedInvoiceLine[],
): InvoiceTotals {
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

### ➕ Créer `src/modules/invoices/domain/invoice-repository.port.ts`

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Invoice } from './invoice';
import { InvoiceStatus } from './invoice-status.enum';
import { InvoiceType } from './invoice-type.enum';
import { ComputedInvoiceLine } from './invoice-totals';

/** Critères de listing des factures. */
export interface ListInvoicesQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur le numéro et le nom du client. */
  search?: string;
  type?: InvoiceType;
  status?: InvoiceStatus;
  customerId?: string;
  /** Bornes sur la date d'ÉMISSION (incluses). */
  from?: Date;
  to?: Date;
}

/** Données de création (tout est déjà résolu et calculé). */
export interface CreateInvoiceData {
  number: string;
  type: InvoiceType;
  customerId: string;
  orderId: string | null;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  paidAmount: number;
  creditNoteForId: string | null;
  notes: string | null;
  createdBy: string;
  lines: ComputedInvoiceLine[];
}

/**
 * Champs modifiables (DRAFT uniquement, garanti par le use case).
 * status est piloté par les transitions ; paidAmount attendra le 08.
 */
export interface UpdateInvoiceData {
  customerId?: string;
  dueDate?: Date;
  notes?: string | null;
  totalHT?: number;
  totalVAT?: number;
  totalTTC?: number;
  /** Remplacement COMPLET des lignes si fourni. */
  lines?: ComputedInvoiceLine[];
  status?: InvoiceStatus;
}

/** Contrat de persistance des factures. */
export interface InvoiceRepositoryPort {
  /** Liste paginée (client joint, SANS les lignes). */
  findAll(query: ListInvoicesQuery): Promise<PaginatedResult<Invoice>>;

  /** Détail complet (lignes triées + client) ; null si inconnue. */
  findById(id: string): Promise<Invoice | null>;

  /** Factures SENT / PARTIALLY_PAID à échéance dépassée (cron). */
  findOverdue(now: Date): Promise<Invoice[]>;

  /** True si une commande a déjà été facturée (anti double facture). */
  existsForOrder(orderId: string): Promise<boolean>;

  /** Prochain numéro de l'année (FAC- ou AV- selon le type). */
  nextNumber(type: InvoiceType): Promise<string>;

  /** Crée la facture ET ses lignes (atomique). */
  create(data: CreateInvoiceData): Promise<Invoice>;

  /** Modifie la facture, remplace les lignes si fournies (atomique). */
  update(id: string, data: UpdateInvoiceData): Promise<Invoice>;

  /** Suppression PHYSIQUE (brouillons uniquement, lignes en cascade). */
  delete(id: string): Promise<void>;
}

/** Jeton d'injection du repository factures. */
export const INVOICE_REPOSITORY = Symbol('INVOICE_REPOSITORY');
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 3 — Les entités TypeORM et le mapper

> Crée l'arborescence `src/modules/invoices/infrastructure/entities/`.

### ➕ Créer `src/modules/invoices/infrastructure/entities/invoice.entity.ts`

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { ContactEntity } from '../../../contacts/infrastructure/entities/contact.entity';
import { OrderEntity } from '../../../orders/infrastructure/entities/order.entity';
import { InvoiceStatus } from '../../domain/invoice-status.enum';
import { InvoiceType } from '../../domain/invoice-type.enum';
import { InvoiceLineEntity } from './invoice-line.entity';

/**
 * Entité TypeORM de la table `invoices` (factures ET avoirs).
 *
 * credit_note_for_id : AUTO-RÉFÉRENCE — un avoir pointe vers la
 * facture qu'il corrige, dans la même table (même pattern que le
 * parent_id des catégories au module 03).
 */
@Entity({ name: 'invoices' })
export class InvoiceEntity extends AuditableEntity {
  /** FAC-2026-0001 ou AV-2026-0001, unique. */
  @Index('UQ_invoices_number', { unique: true })
  @Column({ name: 'number', type: 'nvarchar', length: 20 })
  number!: string;

  @Index('IX_invoices_type')
  @Column({ name: 'type', type: 'nvarchar', length: 12 })
  type!: InvoiceType;

  @Index('IX_invoices_customer')
  @Column({ name: 'customer_id', type: 'uniqueidentifier' })
  customerId!: string;

  @ManyToOne(() => ContactEntity)
  @JoinColumn({ name: 'customer_id' })
  customer?: ContactEntity;

  /** Commande d'origine si conversion (FK nullable vers orders). */
  @Column({ name: 'order_id', type: 'uniqueidentifier', nullable: true })
  orderId!: string | null;

  @ManyToOne(() => OrderEntity, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order?: OrderEntity | null;

  @Index('IX_invoices_status')
  @Column({ name: 'status', type: 'nvarchar', length: 15 })
  status!: InvoiceStatus;

  @Column({ name: 'issue_date', type: 'datetime2' })
  issueDate!: Date;

  /** Index : la tâche OVERDUE filtre sur cette colonne chaque nuit. */
  @Index('IX_invoices_due_date')
  @Column({ name: 'due_date', type: 'datetime2' })
  dueDate!: Date;

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

  /** Propriété exclusive du module 08 — reste à 0 dans ce module. */
  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new DecimalColumnTransformer(),
  })
  paidAmount!: number;

  /** AUTO-RÉFÉRENCE : la facture corrigée par cet avoir. */
  @Column({
    name: 'credit_note_for_id',
    type: 'uniqueidentifier',
    nullable: true,
  })
  creditNoteForId!: string | null;

  @ManyToOne(() => InvoiceEntity, { nullable: true })
  @JoinColumn({ name: 'credit_note_for_id' })
  creditNoteFor?: InvoiceEntity | null;

  /** URL du PDF stocké — branché au niveau min-, colonne déjà prête. */
  @Column({ name: 'pdf_url', type: 'nvarchar', length: 500, nullable: true })
  pdfUrl!: string | null;

  @Column({ name: 'notes', type: 'nvarchar', length: 2000, nullable: true })
  notes!: string | null;

  /** Les lignes vivent et meurent avec la facture. */
  @OneToMany(() => InvoiceLineEntity, (line) => line.invoice, {
    cascade: ['insert'],
  })
  lines?: InvoiceLineEntity[];
}
```

### ➕ Créer `src/modules/invoices/infrastructure/entities/invoice-line.entity.ts`

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
import { InvoiceEntity } from './invoice.entity';

/**
 * Entité TypeORM de la table `invoice_lines`.
 * onDelete: 'CASCADE' : la suppression d'un brouillon emporte ses lignes.
 */
@Entity({ name: 'invoice_lines' })
export class InvoiceLineEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Index('IX_invoice_lines_invoice')
  @Column({ name: 'invoice_id', type: 'uniqueidentifier' })
  invoiceId!: string;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: InvoiceEntity;

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

### ➕ Créer `src/modules/invoices/infrastructure/invoice.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Invoice } from '../domain/invoice';
import { InvoiceLine } from '../domain/invoice-line';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceLineEntity } from './entities/invoice-line.entity';

/** Conversion entités TypeORM -> modèles de domaine. */
@Injectable()
export class InvoiceMapper {
  toDomain(entity: InvoiceEntity): Invoice {
    const lines = [...(entity.lines ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((line) => this.lineToDomain(line));

    return new Invoice(
      entity.id,
      entity.number,
      entity.type,
      entity.customerId,
      entity.customer?.companyName ?? '',
      entity.orderId,
      entity.status,
      entity.issueDate,
      entity.dueDate,
      entity.totalHT,
      entity.totalVAT,
      entity.totalTTC,
      entity.paidAmount,
      entity.creditNoteForId,
      entity.pdfUrl,
      entity.notes,
      entity.createdBy,
      entity.createdAt,
      entity.updatedAt,
      lines,
    );
  }

  private lineToDomain(entity: InvoiceLineEntity): InvoiceLine {
    return new InvoiceLine(
      entity.id,
      entity.invoiceId,
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
npm run migration:generate -- src/database/migrations/CreateInvoicesTables
```

**Relis le fichier généré**. Tu dois y trouver :

- `CREATE TABLE "invoices"` avec `UQ_invoices_number` (**unique**), les index `type`, `customer`, `status`, `due_date`, les QUATRE `decimal(12,2)` (dont `paid_amount DEFAULT 0`) ;
- `CREATE TABLE "invoice_lines"` avec `position` ;
- **cinq `FOREIGN KEY`** : `invoices.customer_id → contacts`, `invoices.order_id → orders` (nullable), **`invoices.credit_note_for_id → invoices`** (l'auto-référence !), `invoice_lines.invoice_id → invoices` avec `ON DELETE CASCADE`, `invoice_lines.product_id → products` ;
- un `down()` qui défait tout ; RIEN sur les tables existantes.

```bash
npm run migration:run
npm run migration:show   # CreateInvoicesTables cochée [X]
```

**✅ Point de contrôle** : la FK `credit_note_for_id` de `invoices` pointe vers… `invoices` (visible dans ton client SQL).

---

## Étape 5 — Le repository

### ➕ Créer `src/modules/invoices/infrastructure/typeorm-invoice.repository.ts`

Troisième repository de document à lignes : tu connais le patron (modules 05/06). Nouveautés : `findOverdue` (opérateur `In` de TypeORM : un `WHERE status IN (...)`) et le filtre `from`/`to` sur la date d'ÉMISSION (plus parlante que la date technique de création pour une facture).

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { TransactionService } from '../../../database/transaction/transaction.service';
import { Invoice } from '../domain/invoice';
import {
  CreateInvoiceData,
  InvoiceRepositoryPort,
  ListInvoicesQuery,
  UpdateInvoiceData,
} from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { InvoiceType } from '../domain/invoice-type.enum';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceLineEntity } from './entities/invoice-line.entity';
import { InvoiceMapper } from './invoice.mapper';

/** Liste blanche de tri (colonnes de la facture + client joint). */
const INVOICE_SORTABLE_COLUMNS: ColumnWhitelist = {
  number: 'invoice.number',
  type: 'invoice.type',
  status: 'invoice.status',
  issueDate: 'invoice.issueDate',
  dueDate: 'invoice.dueDate',
  totalTTC: 'invoice.totalTTC',
  customerName: 'customer.companyName',
  createdAt: 'invoice.createdAt',
};

/** Recherche textuelle : numéro et nom du client. */
const INVOICE_SEARCHABLE_COLUMNS = [
  'invoice.number',
  'customer.companyName',
] as const;

/** Implémentation TypeORM du repository factures. */
@Injectable()
export class TypeOrmInvoiceRepository implements InvoiceRepositoryPort {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly repository: Repository<InvoiceEntity>,
    private readonly transactionService: TransactionService,
    private readonly mapper: InvoiceMapper,
  ) {}

  async findAll(query: ListInvoicesQuery): Promise<PaginatedResult<Invoice>> {
    const queryBuilder = this.repository
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.customer', 'customer');

    if (query.type !== undefined) {
      queryBuilder.andWhere('invoice.type = :type', { type: query.type });
    }
    if (query.status !== undefined) {
      queryBuilder.andWhere('invoice.status = :status', {
        status: query.status,
      });
    }
    if (query.customerId !== undefined) {
      queryBuilder.andWhere('invoice.customerId = :customerId', {
        customerId: query.customerId,
      });
    }
    // Bornes sur la date d'ÉMISSION : c'est elle qui a un sens
    // comptable (période de facturation), pas la date technique.
    if (query.from !== undefined) {
      queryBuilder.andWhere('invoice.issueDate >= :from', {
        from: query.from,
      });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('invoice.issueDate <= :to', { to: query.to });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      INVOICE_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('invoice.createdAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        INVOICE_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Invoice | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { customer: true, lines: true },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findOverdue(now: Date): Promise<Invoice[]> {
    // In() : WHERE status IN ('SENT', 'PARTIALLY_PAID').
    const entities = await this.repository.find({
      where: {
        status: In([InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid]),
        dueDate: LessThan(now),
      },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  existsForOrder(orderId: string): Promise<boolean> {
    return this.repository.exists({ where: { orderId } });
  }

  async nextNumber(type: InvoiceType): Promise<string> {
    const year = new Date().getFullYear();
    // Deux séquences dans la même table : FAC- et AV-, chacune son MAX.
    const prefix = `${type === InvoiceType.Invoice ? 'FAC' : 'AV'}-${year}-`;

    const raw = await this.repository
      .createQueryBuilder('invoice')
      .select('MAX(invoice.number)', 'max')
      .where('invoice.number LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    const lastSequence = raw?.max ? Number(raw.max.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
  }

  async create(data: CreateInvoiceData): Promise<Invoice> {
    const { lines, ...invoiceColumns } = data;

    const entity = this.repository.create({
      ...invoiceColumns,
      lines: lines.map((line, index) => ({ ...line, position: index })),
    });
    const saved = await this.repository.save(entity);

    return (await this.findById(saved.id)) as Invoice;
  }

  async update(id: string, data: UpdateInvoiceData): Promise<Invoice> {
    const { lines, ...invoiceColumns } = data;

    await this.transactionService.execute(async (manager) => {
      const changes: Partial<InvoiceEntity> = {};
      for (const [key, value] of Object.entries(invoiceColumns)) {
        if (value !== undefined) {
          (changes as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(changes).length > 0) {
        await manager.getRepository(InvoiceEntity).update({ id }, changes);
      }

      if (lines !== undefined) {
        const lineRepository = manager.getRepository(InvoiceLineEntity);
        await lineRepository.delete({ invoiceId: id });
        await lineRepository.save(
          lines.map((line, index) =>
            lineRepository.create({ ...line, invoiceId: id, position: index }),
          ),
        );
      }
    });

    return (await this.findById(id)) as Invoice;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 6 — Les cas d'utilisation : CRUD (6)

> Crée le dossier `src/modules/invoices/application/`.

### ➕ Créer `src/modules/invoices/application/list-invoices.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type {
  InvoiceRepositoryPort,
  ListInvoicesQuery,
} from '../domain/invoice-repository.port';

/** Cas d'utilisation : lister les factures (pagination + filtres). */
@Injectable()
export class ListInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
  ) {}

  execute(query: ListInvoicesQuery): Promise<PaginatedResult<Invoice>> {
    return this.invoiceRepository.findAll(query);
  }
}
```

### ➕ Créer `src/modules/invoices/application/get-invoice-by-id.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';

/** Cas d'utilisation : récupérer une facture complète (404 si inconnue). */
@Injectable()
export class GetInvoiceByIdUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
  ) {}

  async execute(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new ResourceNotFoundException('La facture');
    }
    return invoice;
  }
}
```

### ➕ Créer `src/modules/invoices/application/resolve-invoice-lines.helper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { computeInvoiceLines } from '../domain/invoice-totals';
import type {
  ComputedInvoiceLine,
  InvoiceLineDraft,
} from '../domain/invoice-totals';

/** Ligne telle que reçue de l'API (avant résolution). */
export interface InvoiceLineInput {
  productId?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  vatRate?: number;
}

/**
 * Résout chaque ligne de facture — même logique qu'aux modules 05/06 :
 * ligne PRODUIT (contenu copié du catalogue si absent, produit actif
 * exigé) ou ligne LIBRE (description + prix obligatoires).
 */
@Injectable()
export class ResolveInvoiceLinesHelper {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
  ) {}

  async resolve(inputs: InvoiceLineInput[]): Promise<ComputedInvoiceLine[]> {
    const drafts: InvoiceLineDraft[] = [];

    for (const input of inputs) {
      if (input.productId !== undefined) {
        const product = await this.getProductByIdUseCase.execute(
          input.productId,
        );
        if (!product.isActive) {
          throw new BusinessRuleViolationException(
            `Le produit « ${product.name} » est désactivé : il ne peut ` +
              'plus être facturé.',
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

    return computeInvoiceLines(drafts);
  }
}
```

### ➕ Créer `src/modules/invoices/application/create-invoice.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetContactByIdUseCase } from '../../contacts/application/get-contact-by-id.use-case';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { InvoiceType } from '../domain/invoice-type.enum';
import { computeInvoiceTotals } from '../domain/invoice-totals';
import { InvoiceLineInput, ResolveInvoiceLinesHelper } from './resolve-invoice-lines.helper';

/** Délai de paiement par défaut (jours) — configurable au niveau min-. */
const DEFAULT_PAYMENT_TERM_DAYS = 30;

/** Données de création (déjà validées par le DTO). */
export interface CreateInvoiceInput {
  customerId: string;
  dueDate?: string;
  notes?: string;
  lines: InvoiceLineInput[];
  /** Champs internes — jamais exposés dans le DTO. */
  type?: InvoiceType;
  orderId?: string;
  creditNoteForId?: string;
}

/**
 * Cas d'utilisation : créer une facture (statut DRAFT).
 *
 * Sert AUSSI de brique interne : la conversion de commande (orderId)
 * et la création d'avoir (type + creditNoteForId) passent par lui —
 * ces champs internes n'existent pas dans le DTO public.
 */
@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveInvoiceLinesHelper: ResolveInvoiceLinesHelper,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateInvoiceInput,
  ): Promise<Invoice> {
    const contact = await this.getContactByIdUseCase.execute(input.customerId);
    if (!contact.isCustomer()) {
      throw new BusinessRuleViolationException(
        `Le contact « ${contact.companyName} » n'est pas un client : ` +
          'impossible de le facturer.',
      );
    }

    const lines = await this.resolveInvoiceLinesHelper.resolve(input.lines);
    const totals = computeInvoiceTotals(lines);

    const issueDate = new Date();
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : new Date(
          issueDate.getTime() + DEFAULT_PAYMENT_TERM_DAYS * 24 * 60 * 60 * 1000,
        );

    if (dueDate < issueDate) {
      throw new BusinessRuleViolationException(
        "L'échéance ne peut pas être antérieure à la date d'émission.",
      );
    }

    const type = input.type ?? InvoiceType.Invoice;

    return this.invoiceRepository.create({
      number: await this.invoiceRepository.nextNumber(type),
      type,
      customerId: input.customerId,
      orderId: input.orderId ?? null,
      status: InvoiceStatus.Draft,
      issueDate,
      dueDate,
      ...totals,
      paidAmount: 0,
      creditNoteForId: input.creditNoteForId ?? null,
      notes: input.notes ?? null,
      createdBy: actor.userId,
      lines,
    });
  }
}
```

### ➕ Créer `src/modules/invoices/application/update-invoice.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetContactByIdUseCase } from '../../contacts/application/get-contact-by-id.use-case';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type {
  InvoiceRepositoryPort,
  UpdateInvoiceData,
} from '../domain/invoice-repository.port';
import { computeInvoiceTotals } from '../domain/invoice-totals';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';
import { InvoiceLineInput, ResolveInvoiceLinesHelper } from './resolve-invoice-lines.helper';

/** Champs modifiables (sémantique PATCH ; lines = remplacement complet). */
export interface UpdateInvoiceInput {
  customerId?: string;
  dueDate?: string;
  notes?: string;
  lines?: InvoiceLineInput[];
}

/**
 * Cas d'utilisation : modifier une facture — BROUILLON UNIQUEMENT.
 * Envoyée, une facture ne se corrige plus que par un avoir.
 */
@Injectable()
export class UpdateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveInvoiceLinesHelper: ResolveInvoiceLinesHelper,
  ) {}

  async execute(
    invoiceId: string,
    input: UpdateInvoiceInput,
  ): Promise<Invoice> {
    const invoice = await this.getInvoiceByIdUseCase.execute(invoiceId);
    if (!invoice.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une facture en brouillon est modifiable (statut actuel : ` +
          `${invoice.status}). Une facture émise se corrige par un avoir.`,
      );
    }

    const changes: UpdateInvoiceData = {};

    if (input.customerId !== undefined) {
      const contact = await this.getContactByIdUseCase.execute(
        input.customerId,
      );
      if (!contact.isCustomer()) {
        throw new BusinessRuleViolationException(
          `Le contact « ${contact.companyName} » n'est pas un client.`,
        );
      }
      changes.customerId = input.customerId;
    }

    if (input.dueDate !== undefined) {
      const dueDate = new Date(input.dueDate);
      if (dueDate < invoice.issueDate) {
        throw new BusinessRuleViolationException(
          "L'échéance ne peut pas être antérieure à la date d'émission.",
        );
      }
      changes.dueDate = dueDate;
    }

    if (input.notes !== undefined) {
      changes.notes = input.notes;
    }

    if (input.lines !== undefined) {
      const lines = await this.resolveInvoiceLinesHelper.resolve(input.lines);
      const totals = computeInvoiceTotals(lines);
      changes.lines = lines;
      changes.totalHT = totals.totalHT;
      changes.totalVAT = totals.totalVAT;
      changes.totalTTC = totals.totalTTC;
    }

    return this.invoiceRepository.update(invoiceId, changes);
  }
}
```

### ➕ Créer `src/modules/invoices/application/delete-invoice.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';

/**
 * Cas d'utilisation : supprimer une facture — BROUILLON UNIQUEMENT.
 * Une facture émise ne disparaît JAMAIS : c'est une pièce comptable.
 */
@Injectable()
export class DeleteInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoiceByIdUseCase.execute(invoiceId);
    if (!invoice.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une facture en brouillon peut être supprimée (statut ` +
          `actuel : ${invoice.status}).`,
      );
    }

    await this.invoiceRepository.delete(invoiceId);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 7 — Les cas d'utilisation : transitions, avoir & cron (4 + 1 tâche)

### ➕ Créer `src/modules/invoices/application/send-invoice.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';

/**
 * Cas d'utilisation : émettre une facture (DRAFT -> SENT).
 *
 * LE POINT DE NON-RETOUR : après cet appel, la facture ne sera plus
 * jamais modifiée ni supprimée. Version minimale : transition seule —
 * le PDF (généré, stocké, pdfUrl) et l'e-mail au client arrivent au
 * niveau min- sans changer cette transition.
 */
@Injectable()
export class SendInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(invoiceId: string): Promise<Invoice> {
    const invoice = await this.getInvoiceByIdUseCase.execute(invoiceId);
    if (!invoice.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une facture en brouillon peut être émise (statut actuel : ` +
          `${invoice.status}).`,
      );
    }

    return this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.Sent,
    });
  }
}
```

### ➕ Créer `src/modules/invoices/application/cancel-invoice.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';

/**
 * Cas d'utilisation : annuler une facture — DRAFT ou SENT uniquement.
 * Dès qu'un centime a été encaissé (PARTIALLY_PAID, PAID), l'annulation
 * est interdite : la correction comptable est l'AVOIR.
 */
@Injectable()
export class CancelInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(invoiceId: string): Promise<Invoice> {
    const invoice = await this.getInvoiceByIdUseCase.execute(invoiceId);
    if (!invoice.isCancellable()) {
      throw new BusinessRuleViolationException(
        `Cette facture (statut ${invoice.status}) ne peut plus être ` +
          'annulée : créez un avoir (POST /invoices/:id/credit-note).',
      );
    }

    return this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.Cancelled,
    });
  }
}
```

### ➕ Créer `src/modules/invoices/application/create-credit-note.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceType } from '../domain/invoice-type.enum';
import { CreateInvoiceUseCase } from './create-invoice.use-case';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';
import { InvoiceLineInput } from './resolve-invoice-lines.helper';

/** Données de création d'un avoir. */
export interface CreateCreditNoteInput {
  /** Absentes : copie TOUTES les lignes de la source (avoir total).
   *  Fournies : avoir PARTIEL sur ces lignes uniquement. */
  lines?: InvoiceLineInput[];
  notes?: string;
}

/**
 * Cas d'utilisation : créer un AVOIR depuis une facture émise.
 *
 * L'avoir est une facture de type CREDIT_NOTE, numérotée AV-YYYY-NNNN,
 * liée à sa source par creditNoteForId. Montants en POSITIF (le type
 * porte le sens). La facture source ne change PAS de statut : le
 * rapprochement comptable (netting) appartient au module 08.
 */
@Injectable()
export class CreateCreditNoteUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    sourceInvoiceId: string,
    input: CreateCreditNoteInput,
  ): Promise<Invoice> {
    const source = await this.getInvoiceByIdUseCase.execute(sourceInvoiceId);

    if (!source.isCreditable()) {
      throw new BusinessRuleViolationException(
        source.type === InvoiceType.CreditNote
          ? 'Un avoir ne peut pas recevoir d’avoir : refacturez si besoin.'
          : `Seule une facture émise peut recevoir un avoir (statut ` +
            `actuel : ${source.status}). Un brouillon se corrige ` +
            'directement.',
      );
    }

    // Lignes fournies = avoir partiel ; absentes = copie intégrale de
    // la source (avoir total). Les lignes copiées gardent les prix
    // FIGÉS de la facture — pas ceux du catalogue d'aujourd'hui.
    const lines: InvoiceLineInput[] =
      input.lines ??
      source.lines.map((line) => ({
        productId: line.productId ?? undefined,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate,
      }));

    return this.createInvoiceUseCase.execute(actor, {
      customerId: source.customerId,
      notes:
        input.notes ?? `Avoir sur la facture ${source.number}.`,
      lines,
      type: InvoiceType.CreditNote,
      creditNoteForId: source.id,
    });
  }
}
```

### ➕ Créer `src/modules/invoices/application/check-overdue-invoices.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';

/**
 * Cas d'utilisation : marquer OVERDUE les factures à échéance dépassée
 * (SENT et PARTIALLY_PAID). Appelé par la tâche planifiée. Idempotent.
 */
@Injectable()
export class CheckOverdueInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
  ) {}

  /** Renvoie le nombre de factures passées en retard. */
  async execute(): Promise<number> {
    const overdue = await this.invoiceRepository.findOverdue(new Date());

    for (const invoice of overdue) {
      await this.invoiceRepository.update(invoice.id, {
        status: InvoiceStatus.Overdue,
      });
    }

    return overdue.length;
  }
}
```

### ➕ Créer `src/modules/invoices/application/check-overdue-invoices.task.ts`

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { observabilityConfig } from '../../../config/observability.config';
import { CheckOverdueInvoicesUseCase } from './check-overdue-invoices.use-case';

/**
 * Tâche planifiée : détection des factures en retard.
 * Quotidienne à 02:00 (une heure après l'expiration des devis) —
 * même pattern que les tâches des modules 00 et 05 : interrupteur
 * SCHEDULER_ENABLED, verrou anti-chevauchement, erreurs capturées.
 */
@Injectable()
export class CheckOverdueInvoicesTask {
  private readonly logger = new Logger(CheckOverdueInvoicesTask.name);
  private running = false;

  constructor(
    private readonly checkOverdueInvoicesUseCase: CheckOverdueInvoicesUseCase,
    @Inject(observabilityConfig.KEY)
    private readonly config: ConfigType<typeof observabilityConfig>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron(): Promise<void> {
    if (!this.config.schedulerEnabled) {
      return;
    }
    await this.execute();
  }

  /** Marque les retards ; renvoie le nombre de factures traitées. */
  async execute(): Promise<number> {
    if (this.running) {
      this.logger.warn(
        'Détection des retards ignorée : une exécution est déjà en cours.',
      );
      return 0;
    }

    this.running = true;
    const startedAt = Date.now();

    try {
      const count = await this.checkOverdueInvoicesUseCase.execute();
      this.logger.log(
        `Détection des retards : terminée en ${Date.now() - startedAt} ms, ` +
          `${count} facture(s) passée(s) en OVERDUE.`,
      );
      return count;
    } catch (error) {
      this.logger.error(
        `Détection des retards : échec — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 8 — Les DTOs

> Crée le dossier `src/modules/invoices/presentation/dto/`.

### ➕ Créer `src/modules/invoices/presentation/dto/invoice-line-input.dto.ts`

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
 * Une ligne du corps de création/modification de facture — même
 * dualité qu'aux modules 05/06 : ligne PRODUIT ou ligne LIBRE.
 */
export class InvoiceLineInputDto {
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

  @ApiProperty({ description: 'Quantité (2 décimales max).', example: 2 })
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

### ➕ Créer `src/modules/invoices/presentation/dto/create-invoice.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineInputDto } from './invoice-line-input.dto';

/**
 * Corps de POST /invoices (création MANUELLE).
 * Pas d'orderId ici : facturer une commande passe par
 * POST /orders/:id/invoice, qui vérifie le statut de la commande.
 */
export class CreateInvoiceDto {
  @ApiProperty({ description: 'Contact client (type CUSTOMER ou BOTH).' })
  @IsUUID(undefined, {
    message: 'Le customerId doit être un UUID valide.',
  })
  customerId!: string;

  @ApiPropertyOptional({
    description:
      "Date d'échéance (ISO 8601). Défaut : émission + 30 jours.",
    example: '2026-08-15',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Le champ "dueDate" doit être une date ISO.' },
  )
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Facturation prestation juillet 2026.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;

  @ApiProperty({
    description: 'Lignes de la facture (au moins une).',
    type: [InvoiceLineInputDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Une facture doit contenir au moins une ligne.',
  })
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInputDto)
  lines!: InvoiceLineInputDto[];
}
```

### ➕ Créer `src/modules/invoices/presentation/dto/update-invoice.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateInvoiceDto } from './create-invoice.dto';

/**
 * Corps de PATCH /invoices/:id (brouillons uniquement).
 * Si `lines` est fourni : remplacement complet + totaux recalculés.
 */
export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}
```

### ➕ Créer `src/modules/invoices/presentation/dto/create-credit-note.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineInputDto } from './invoice-line-input.dto';

/** Corps de POST /invoices/:id/credit-note. */
export class CreateCreditNoteDto {
  @ApiPropertyOptional({
    description:
      'Lignes de l’avoir. ABSENTES : copie intégrale de la facture ' +
      'source (avoir total). FOURNIES : avoir partiel.',
    type: [InvoiceLineInputDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Un avoir partiel doit contenir au moins une ligne.',
  })
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInputDto)
  lines?: InvoiceLineInputDto[];

  @ApiPropertyOptional({
    example: 'Remboursement de deux écrans défectueux.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;
}
```

### ➕ Créer `src/modules/invoices/presentation/dto/list-invoices-query.dto.ts`

```typescript
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { InvoiceStatus } from '../../domain/invoice-status.enum';
import { InvoiceType } from '../../domain/invoice-type.enum';

/**
 * Query string de GET /invoices — pagination + plage de dates (from/to
 * sur la date d'ÉMISSION) via IntersectionType.
 */
export class ListInvoicesQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ enum: InvoiceType })
  @IsOptional()
  @IsEnum(InvoiceType, {
    message: 'Le type doit valoir INVOICE ou CREDIT_NOTE.',
  })
  type?: InvoiceType;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus, {
    message:
      'Le statut doit valoir DRAFT, SENT, PARTIALLY_PAID, PAID, ' +
      'OVERDUE ou CANCELLED.',
  })
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Filtre par client.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "customerId" doit être un UUID valide.',
  })
  customerId?: string;
}
```

### ➕ Créer `src/modules/invoices/presentation/dto/invoice-line-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { InvoiceLine } from '../../domain/invoice-line';

/** Représentation publique d'une ligne de facture. */
export class InvoiceLineResponseDto {
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

  static fromDomain(line: InvoiceLine): InvoiceLineResponseDto {
    const dto = new InvoiceLineResponseDto();
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

### ➕ Créer `src/modules/invoices/presentation/dto/invoice-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Invoice } from '../../domain/invoice';
import { InvoiceStatus } from '../../domain/invoice-status.enum';
import { InvoiceType } from '../../domain/invoice-type.enum';
import { InvoiceLineResponseDto } from './invoice-line-response.dto';

/**
 * Représentation publique d'une facture ou d'un avoir.
 * remainingAmount est CALCULÉ à la volée (jamais stocké).
 */
export class InvoiceResponseDto {
  @ApiProperty({ description: 'Identifiant de la facture (UUID).' })
  id!: string;

  @ApiProperty({ example: 'FAC-2026-0001' })
  number!: string;

  @ApiProperty({ enum: InvoiceType })
  type!: InvoiceType;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  customerId!: string;

  @ApiProperty({ example: 'ACME Industries' })
  customerName!: string;

  @ApiProperty({
    nullable: true,
    description: 'Commande d’origine si la facture vient d’une conversion.',
  })
  orderId!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Facture corrigée par cet avoir (CREDIT_NOTE uniquement).',
  })
  creditNoteForId!: string | null;

  @ApiProperty({ description: "Date d'émission." })
  issueDate!: Date;

  @ApiProperty({ description: "Date d'échéance." })
  dueDate!: Date;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: [InvoiceLineResponseDto] })
  lines!: InvoiceLineResponseDto[];

  @ApiProperty({ example: 912.3 })
  totalHT!: number;

  @ApiProperty({ example: 182.46 })
  totalVAT!: number;

  @ApiProperty({ example: 1094.76 })
  totalTTC!: number;

  @ApiProperty({ description: 'Déjà encaissé (module 08).', example: 0 })
  paidAmount!: number;

  @ApiProperty({ description: 'Reste à payer (TTC - payé).', example: 1094.76 })
  remainingAmount!: number;

  @ApiProperty({
    nullable: true,
    description: 'URL du PDF (branché au niveau min-).',
  })
  pdfUrl!: string | null;

  @ApiProperty({ nullable: true, description: 'UUID du créateur.' })
  createdBy!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(invoice: Invoice): InvoiceResponseDto {
    const dto = new InvoiceResponseDto();
    dto.id = invoice.id;
    dto.number = invoice.number;
    dto.type = invoice.type;
    dto.status = invoice.status;
    dto.customerId = invoice.customerId;
    dto.customerName = invoice.customerName;
    dto.orderId = invoice.orderId;
    dto.creditNoteForId = invoice.creditNoteForId;
    dto.issueDate = invoice.issueDate;
    dto.dueDate = invoice.dueDate;
    dto.notes = invoice.notes;
    dto.lines = invoice.lines.map(InvoiceLineResponseDto.fromDomain);
    dto.totalHT = invoice.totalHT;
    dto.totalVAT = invoice.totalVAT;
    dto.totalTTC = invoice.totalTTC;
    dto.paidAmount = invoice.paidAmount;
    dto.remainingAmount = invoice.remainingAmount();
    dto.pdfUrl = invoice.pdfUrl;
    dto.createdBy = invoice.createdBy;
    dto.createdAt = invoice.createdAt;
    dto.updatedAt = invoice.updatedAt;
    return dto;
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 9 — Le contrôleur

### ➕ Créer `src/modules/invoices/presentation/invoices.controller.ts`

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
import { CancelInvoiceUseCase } from '../application/cancel-invoice.use-case';
import { CreateCreditNoteUseCase } from '../application/create-credit-note.use-case';
import { CreateInvoiceUseCase } from '../application/create-invoice.use-case';
import { DeleteInvoiceUseCase } from '../application/delete-invoice.use-case';
import { GetInvoiceByIdUseCase } from '../application/get-invoice-by-id.use-case';
import { ListInvoicesUseCase } from '../application/list-invoices.use-case';
import { SendInvoiceUseCase } from '../application/send-invoice.use-case';
import { UpdateInvoiceUseCase } from '../application/update-invoice.use-case';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

/**
 * Contrôleur des factures et avoirs.
 * Lecture ouverte à tous les rôles ; écriture ADMIN/MANAGER ;
 * suppression (brouillons) ADMIN.
 */
@ApiTags('Factures')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly listInvoicesUseCase: ListInvoicesUseCase,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    private readonly updateInvoiceUseCase: UpdateInvoiceUseCase,
    private readonly deleteInvoiceUseCase: DeleteInvoiceUseCase,
    private readonly sendInvoiceUseCase: SendInvoiceUseCase,
    private readonly cancelInvoiceUseCase: CancelInvoiceUseCase,
    private readonly createCreditNoteUseCase: CreateCreditNoteUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des factures et avoirs',
    description:
      'Filtres : type, status, customerId, from/to (date d’ÉMISSION, ' +
      'ISO), search (numéro / nom du client).',
  })
  @ApiOkResponse({ type: [InvoiceResponseDto] })
  async list(
    @Query() query: ListInvoicesQueryDto,
  ): Promise<PaginatedResult<InvoiceResponseDto>> {
    const result = await this.listInvoicesUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      type: query.type,
      status: query.status,
      customerId: query.customerId,
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(InvoiceResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une facture (avec ses lignes)" })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiNotFoundResponse({ description: 'Facture inconnue.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.getInvoiceByIdUseCase.execute(id);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Créer une facture manuelle (statut DRAFT)',
    description:
      'Numéro auto FAC-YYYY-NNNN, échéance par défaut +30 jours. Pour ' +
      'facturer une commande livrée : POST /orders/:id/invoice.',
  })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiNotFoundResponse({ description: 'Client ou produit inconnu.' })
  @ApiConflictResponse({
    description:
      'Contact non client, produit désactivé, ligne libre incomplète ' +
      'ou échéance antérieure à l’émission.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.createInvoiceUseCase.execute(user, body);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Modifier une facture (DRAFT uniquement)',
    description: 'Émise, une facture se corrige par un AVOIR.',
  })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiNotFoundResponse({ description: 'Facture inconnue.' })
  @ApiConflictResponse({ description: 'Facture non modifiable.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.updateInvoiceUseCase.execute(id, body);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une facture (DRAFT uniquement)',
    description: 'Une facture émise ne disparaît jamais (pièce comptable).',
  })
  @ApiNoContentResponse({ description: 'Facture supprimée.' })
  @ApiConflictResponse({ description: 'Facture non supprimable.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteInvoiceUseCase.execute(id);
  }

  @Post(':id/send')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Émettre une facture (DRAFT → SENT)',
    description:
      'LE POINT DE NON-RETOUR : plus de modification ni de suppression ' +
      'ensuite. PDF + e-mail arrivent au niveau min-.',
  })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async send(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.sendInvoiceUseCase.execute(id);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Post(':id/cancel')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Annuler une facture (DRAFT ou SENT)',
    description: 'Payée même partiellement : créer un avoir à la place.',
  })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiConflictResponse({
    description: 'Facture payée (même partiellement) ou déjà annulée.',
  })
  async cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.cancelInvoiceUseCase.execute(id);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Post(':id/credit-note')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Créer un avoir depuis une facture émise',
    description:
      'Sans lignes : avoir TOTAL (copie de la source). Avec lignes : ' +
      'avoir PARTIEL. Numéroté AV-YYYY-NNNN, lié par creditNoteForId.',
  })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiConflictResponse({
    description: 'Facture non émise, ou déjà un avoir.',
  })
  async createCreditNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateCreditNoteDto,
  ): Promise<InvoiceResponseDto> {
    const creditNote = await this.createCreditNoteUseCase.execute(
      user,
      id,
      body,
    );
    return InvoiceResponseDto.fromDomain(creditNote);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 10 — Le module + AppModule

### ➕ Créer `src/modules/invoices/invoices.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { ContactsModule } from '../contacts/contacts.module';
import { CancelInvoiceUseCase } from './application/cancel-invoice.use-case';
import { CheckOverdueInvoicesTask } from './application/check-overdue-invoices.task';
import { CheckOverdueInvoicesUseCase } from './application/check-overdue-invoices.use-case';
import { CreateCreditNoteUseCase } from './application/create-credit-note.use-case';
import { CreateInvoiceUseCase } from './application/create-invoice.use-case';
import { DeleteInvoiceUseCase } from './application/delete-invoice.use-case';
import { GetInvoiceByIdUseCase } from './application/get-invoice-by-id.use-case';
import { ListInvoicesUseCase } from './application/list-invoices.use-case';
import { ResolveInvoiceLinesHelper } from './application/resolve-invoice-lines.helper';
import { SendInvoiceUseCase } from './application/send-invoice.use-case';
import { UpdateInvoiceUseCase } from './application/update-invoice.use-case';
import { INVOICE_REPOSITORY } from './domain/invoice-repository.port';
import { InvoiceEntity } from './infrastructure/entities/invoice.entity';
import { InvoiceLineEntity } from './infrastructure/entities/invoice-line.entity';
import { InvoiceMapper } from './infrastructure/invoice.mapper';
import { TypeOrmInvoiceRepository } from './infrastructure/typeorm-invoice.repository';
import { InvoicesController } from './presentation/invoices.controller';

/**
 * Module de facturation (factures et avoirs).
 *
 * ⚠️ N'importe PAS OrdersModule (c'est OrdersModule qui importera
 * InvoicesModule pour la facturation de commande — l'inverse créerait
 * un cycle). La FK invoices.order_id passe par l'entité seule.
 *
 * Exports : INVOICE_REPOSITORY + CreateInvoiceUseCase (facturation de
 * commande, étape 11) + GetInvoiceByIdUseCase (module 08, paiements).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceEntity, InvoiceLineEntity]),
    ContactsModule,
    CatalogueModule,
    DatabaseModule,
  ],
  controllers: [InvoicesController],
  providers: [
    InvoiceMapper,
    ResolveInvoiceLinesHelper,
    ListInvoicesUseCase,
    GetInvoiceByIdUseCase,
    CreateInvoiceUseCase,
    UpdateInvoiceUseCase,
    DeleteInvoiceUseCase,
    SendInvoiceUseCase,
    CancelInvoiceUseCase,
    CreateCreditNoteUseCase,
    CheckOverdueInvoicesUseCase,
    CheckOverdueInvoicesTask,
    {
      provide: INVOICE_REPOSITORY,
      useClass: TypeOrmInvoiceRepository,
    },
  ],
  exports: [INVOICE_REPOSITORY, CreateInvoiceUseCase, GetInvoiceByIdUseCase],
})
export class InvoicesModule {}
```

### ✏️ Modifier `src/app.module.ts`

**1)** Ajoute l'import :

```typescript
import { InvoicesModule } from './modules/invoices/invoices.module';
```

**2)** Dans le tableau `imports`, après `OrdersModule` :

```typescript
    QuotesModule,
    OrdersModule,
    InvoicesModule,
    AuthenticationModule,
```

**✅ Point de contrôle** : `npm run build` puis `npm run start:dev` — les 8 routes `/api/v1/invoices*` apparaissent.

---

## Étape 11 — La conversion commande → facture

Même pattern qu'au module 06 (devis → commande) : le use case vit dans le module COMMANDES (c'est une action sur une commande), qui importe le module FACTURES.

### ➕ Créer `src/modules/orders/application/convert-order-to-invoice.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { CreateInvoiceUseCase } from '../../invoices/application/create-invoice.use-case';
import { Invoice } from '../../invoices/domain/invoice';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/**
 * Cas d'utilisation : facturer une commande client LIVRÉE.
 *
 * Règles :
 *   - commande CUSTOMER uniquement (on ne facture pas ses fournisseurs,
 *     ce sont eux qui nous facturent) ;
 *   - statut DELIVERED uniquement (on facture ce qui a été livré) ;
 *   - une commande ne se facture qu'UNE fois (la facture porte orderId) ;
 *   - lignes copiées TELLES QUELLES (prix figés de la commande).
 */
@Injectable()
export class ConvertOrderToInvoiceUseCase {
  constructor(
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
  ) {}

  async execute(actor: AuthenticatedUser, orderId: string): Promise<Invoice> {
    const order = await this.getOrderByIdUseCase.execute(orderId);

    if (order.type !== OrderType.Customer) {
      throw new BusinessRuleViolationException(
        'Seule une commande CLIENT peut être facturée.',
      );
    }
    if (order.status !== OrderStatus.Delivered) {
      throw new BusinessRuleViolationException(
        `Seule une commande livrée peut être facturée (statut actuel : ` +
          `${order.status}).`,
      );
    }
    if (await this.invoiceRepository.existsForOrder(orderId)) {
      throw new BusinessRuleViolationException(
        `La commande ${order.number} a déjà été facturée.`,
      );
    }

    return this.createInvoiceUseCase.execute(actor, {
      customerId: order.contactId,
      notes: `Facture de la commande ${order.number}.`,
      orderId: order.id,
      lines: order.lines.map((line) => ({
        productId: line.productId ?? undefined,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate,
      })),
    });
  }
}
```

### ✏️ Modifier `src/modules/orders/presentation/orders.controller.ts`

**1)** Ajoute les imports :

```typescript
import { ConvertOrderToInvoiceUseCase } from '../application/convert-order-to-invoice.use-case';
import { InvoiceResponseDto } from '../../invoices/presentation/dto/invoice-response.dto';
```

**2)** Ajoute le use case au constructeur :

```typescript
    private readonly convertOrderToInvoiceUseCase: ConvertOrderToInvoiceUseCase,
```

**3)** Ajoute la route à la fin de la classe (après `cancel`) :

```typescript
  @Post(':id/invoice')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Facturer une commande client livrée',
    description:
      'Crée une facture DRAFT (FAC-YYYY-NNNN) avec les lignes de la ' +
      'commande, prix figés. Une commande ne se facture qu’une fois.',
  })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiConflictResponse({
    description:
      'Commande fournisseur, non livrée, ou déjà facturée.',
  })
  async invoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.convertOrderToInvoiceUseCase.execute(user, id);
    return InvoiceResponseDto.fromDomain(invoice);
  }
```

### ✏️ Modifier `src/modules/orders/orders.module.ts`

**1)** Ajoute les imports :

```typescript
import { InvoicesModule } from '../invoices/invoices.module';
import { ConvertOrderToInvoiceUseCase } from './application/convert-order-to-invoice.use-case';
```

**2)** Ajoute `InvoicesModule` au tableau `imports` et le use case aux `providers` :

```typescript
    StockModule,
    DatabaseModule,
    // Facturation de commande. Sens UNIQUE : InvoicesModule n'importe
    // jamais OrdersModule (cycle interdit).
    InvoicesModule,
```

```typescript
    CancelOrderUseCase,
    ConvertOrderToInvoiceUseCase,
```

**✅ Point de contrôle** : `npm run build` puis `npm run start:dev` — la route `POST /api/v1/orders/:id/invoice` apparaît dans la section « Commandes ».

---

## Étape 12 — Vérifier que ça marche & ce qu'on verra plus tard

### 12.1 Parcours manuel (PowerShell)

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion + prérequis : client et produit
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

$client = Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"type":"CUSTOMER","companyName":"ACME Industries"}'
$prod = Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Écran Dell 27\" QHD","type":"PRODUCT","unit":"UNIT","unitPrice":349.90}'

# 2. Facture manuelle : ligne produit + ligne libre
$fac = Invoke-RestMethod -Method Post -Uri "$base/invoices" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"customerId":"' + $client.data.id + '",' +
         '"lines":[' +
         '{"productId":"' + $prod.data.id + '","quantity":2},' +
         '{"description":"Installation sur site","quantity":2.5,"unitPrice":85}' +
         ']}')
$fac.data.number            # → FAC-2026-0001
$fac.data.totalTTC          # → 1094.76 (912.30 HT + 182.46 TVA)
$fac.data.remainingAmount   # → 1094.76 (rien d'encaissé : module 08)
$fac.data.dueDate           # → émission + 30 jours

# 3. Émettre : LE POINT DE NON-RETOUR
Invoke-RestMethod -Method Post -Uri "$base/invoices/$($fac.data.id)/send" `
  -Headers $headers | Out-Null

# 4. La preuve : modifier une facture émise → 409
try {
  Invoke-RestMethod -Method Patch -Uri "$base/invoices/$($fac.data.id)" `
    -Headers $headers -ContentType 'application/json' -Body '{"notes":"trop tard"}'
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 5. L'AVOIR PARTIEL : rembourser un seul écran
$avoir = Invoke-RestMethod -Method Post -Uri "$base/invoices/$($fac.data.id)/credit-note" `
  -Headers $headers -ContentType 'application/json' `
  -Body ('{"notes":"Un écran arrivé fissuré.",' +
         '"lines":[{"productId":"' + $prod.data.id + '","quantity":1,"unitPrice":349.90}]}')
$avoir.data.number            # → AV-2026-0001 (séquence dédiée)
$avoir.data.type              # → CREDIT_NOTE
$avoir.data.creditNoteForId   # → l'id de FAC-2026-0001 (le lien)
$avoir.data.totalTTC          # → 419.88 (en POSITIF : le type porte le sens)

# 6. Un avoir d'avoir → 409 (on refacture, on n'empile pas les corrections)
Invoke-RestMethod -Method Post -Uri "$base/invoices/$($avoir.data.id)/send" -Headers $headers | Out-Null
try {
  Invoke-RestMethod -Method Post -Uri "$base/invoices/$($avoir.data.id)/credit-note" `
    -Headers $headers -ContentType 'application/json' -Body '{}'
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 7. FACTURER UNE COMMANDE : une commande de service, livrée sans stock
$cmd = Invoke-RestMethod -Method Post -Uri "$base/orders" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"type":"CUSTOMER","contactId":"' + $client.data.id + '",' +
         '"lines":[{"description":"Audit réseau complet","quantity":1,"unitPrice":1200}]}')
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd.data.id)/confirm" -Headers $headers | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd.data.id)/start" -Headers $headers `
  -ContentType 'application/json' -Body '{}' | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd.data.id)/complete" -Headers $headers `
  -ContentType 'application/json' -Body '{}' | Out-Null

$facCmd = Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd.data.id)/invoice" -Headers $headers
$facCmd.data.number    # → FAC-2026-0002
$facCmd.data.orderId   # → l'id de la commande (traçabilité)

# 8. Double facturation → 409
try {
  Invoke-RestMethod -Method Post -Uri "$base/orders/$($cmd.data.id)/invoice" -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 9. Le cron OVERDUE, sans attendre 2 h du matin : crée une facture
#    échue demain... impossible à tester en direct — mais tu peux
#    vérifier la requête du repository : liste les impayés
Invoke-RestMethod -Uri "$base/invoices?status=SENT" -Headers $headers |
  ConvertTo-Json -Depth 5

# 10. Filtres : uniquement les avoirs
Invoke-RestMethod -Uri "$base/invoices?type=CREDIT_NOTE" -Headers $headers |
  ConvertTo-Json -Depth 5
```

Même parcours possible à la souris dans **Swagger**.

> 💡 **Tester le passage en OVERDUE sans attendre le cron** : pose une échéance dépassée directement en SQL (`UPDATE invoices SET due_date = '2026-01-01' WHERE number = 'FAC-2026-0001'`), puis appelle `execute()` de la tâche depuis un test — ou attends 02:00. Le guide complet automatise ce scénario.

### 12.2 Les pièges croisés en route (mémo)

| Piège | Parade |
|---|---|
| Modifier/supprimer une facture émise | INTERDIT par conception : la correction est l'avoir |
| Stocker `remainingAmount` | Jamais : donnée dérivée = calculée (`totalTTC - paidAmount`) |
| Montants d'avoir négatifs disséminés partout | Convention : montants POSITIFS, le type `CREDIT_NOTE` porte le sens |
| Deux séquences dans une table | Préfixes FAC-/AV-, chacun son `MAX` (comme CMD-/CDF- au module 06) |
| `orderId` accepté dans le DTO de création manuelle | Non : la facturation de commande passe par `/orders/:id/invoice` qui VÉRIFIE le statut — sinon on facturerait des commandes non livrées |
| `WHERE status IN (...)` avec TypeORM | Opérateur `In([...])` dans le `find` |
| `paidAmount` modifié par ce module | Jamais : propriété exclusive du module 08 |
| InvoicesModule ↔ OrdersModule : cycle | Sens unique : Orders importe Invoices ; la FK `order_id` passe par l'entité |

### 12.3 Ce qu'on verra plus tard (rien n'est perdu)

| Différé | Pourquoi ce n'est pas bloquant | Niveau |
|---|---|---|
| **PDF de la facture** (génération, stockage, `pdfUrl`, `GET /invoices/:id/pdf`) | La facture existe et est juste ; la colonne `pdf_url` est DÉJÀ en base, aucune migration à prévoir | 🟡 min- |
| **E-mail au client** à l'émission (PDF en pièce jointe) | La transition SENT est en place ; le mail s'y branchera sans la changer | 🟡 min- |
| **Config société** (SIRET, IBAN, mentions légales) | Ne sert qu'au template PDF | 🟡 min- |
| **`findByCustomer`** (relevé de compte client) | `GET /invoices?customerId=` couvre le besoin | 🟡 min- |
| **Statuts PARTIALLY_PAID / PAID** | Ils existent dans l'enum ; c'est le module 08 qui les posera via les paiements | ⏭️ module 08 |
| **Factorisation des calculs de lignes** (05/06/07 ont trois copies proches) | Trois copies lisibles valent mieux qu'une abstraction précipitée | 🟡 min- |
| **Audit** (`invoices.*`) | `createdBy` trace l'auteur ; le journal central est un plus | 🟡 min- |
| **Tests** (unit : avoir sur brouillon, annulation d'une payée, OVERDUE ; e2e : cycle complet) | L'application fonctionne ; garantie long terme | 🔴 complet |

### 12.4 Ce que ce module t'a appris de nouveau

1. **Le document légal immuable** : la contrainte n'est pas technique mais COMPTABLE — et toute la conception (avoir, annulation restreinte, suppression interdite) en découle.
2. **L'auto-référence** : `credit_note_for_id → invoices.id`, une table qui se pointe elle-même pour lier une correction à sa source.
3. **La donnée dérivée jamais stockée** : `remainingAmount` est une méthode du domaine, pas une colonne — une copie stockée finirait par diverger.
4. **Les états « en attente d'un autre module »** : `PARTIALLY_PAID`/`PAID` sont déclarés, documentés, et personne ne les pose encore — l'enum raconte le plan d'ensemble.
5. **Le use case-brique** : `CreateInvoiceUseCase` sert l'API publique ET les usages internes (avoir, conversion) via des champs d'input jamais exposés dans le DTO.
6. **La chaîne complète** : devis → commande → livraison (stock) → facture — quatre modules, zéro cycle de dépendance.

---

*Fin du guide mini-DEV-07. Prochain module : les paiements (08) — encaissements, `paidAmount` enfin vivant, et les statuts PARTIALLY_PAID/PAID qui attendaient leur heure.*
