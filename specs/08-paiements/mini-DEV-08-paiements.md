# mini-DEV-08 · Paiements & Suivi des Impayés — l'essentiel pour démarrer

> **Spec couverte** : `specs/08-paiements/08-paiements.md` (version minimale)
> **Niveau** : 🟢 fonctionnel — même logique que les `mini-DEV-01` à `07` (voir `RECAP-DEV-01` pour la philosophie des 3 niveaux).
> **Prérequis** : `mini-DEV-01` à `mini-DEV-07` terminés (les paiements s'encaissent sur les factures du module 07).
> **Promesse** : à la fin, des encaissements enregistrés sur les factures émises (virement, carte, espèces, chèque…), un statut de facture qui bascule AUTOMATIQUEMENT — `PARTIALLY_PAID` puis `PAID` : **les statuts déclarés au module 07 prennent enfin vie**, `paidAmount` cesse d'être un zéro décoratif. Le montant payé est toujours RECALCULÉ depuis le journal des paiements (jamais incrémenté), la suppression d'un paiement (ADMIN) recorrige tout, et un résumé des impayés trie les factures par reste à payer. 5 routes dans Swagger. Environ 2 h 30.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — Le domaine : méthode de paiement, paiement](#étape-1--le-domaine--méthode-de-paiement-paiement)
- [Étape 2 — Le port du repository](#étape-2--le-port-du-repository)
- [Étape 3 — L'entité TypeORM et le mapper](#étape-3--lentité-typeorm-et-le-mapper)
- [Étape 4 — La migration](#étape-4--la-migration)
- [Étape 5 — Le repository](#étape-5--le-repository)
- [Étape 6 — La retouche au module 07](#étape-6--la-retouche-au-module-07)
- [Étape 7 — Les cas d'utilisation (5)](#étape-7--les-cas-dutilisation-5)
- [Étape 8 — Les DTOs](#étape-8--les-dtos)
- [Étape 9 — Le contrôleur](#étape-9--le-contrôleur)
- [Étape 10 — Le module + AppModule](#étape-10--le-module--appmodule)
- [Étape 11 — Vérifier que ça marche & ce qu'on verra plus tard](#étape-11--vérifier-que-ça-marche--ce-quon-verra-plus-tard)

---

## 0 · Avant de commencer

- API démarrée, base à jour, tables `contacts`, `products` et surtout `invoices` / `invoice_lines` présentes (modules 02, 03 et 07 appliqués).
- Pour les rappels sur le socle : section A de `mini-DEV-01`.

### Les nouveautés de ce module

1. **La boucle inter-modules se ferme.** Le module 07 avait déclaré `PARTIALLY_PAID`, `PAID` et `paidAmount` « propriété exclusive du module 08 » — sans que RIEN ne les pose. Le moment est venu : chaque encaissement (et chaque suppression d'encaissement) recalcule le montant payé ET le statut de la facture. Concevoir des états qui attendent leur module, puis les faire vivre : c'est ça, un monolithe modulaire.
2. **Le recalcul comme source de vérité.** `paidAmount` n'est JAMAIS incrémenté (`+= amount`) : il est recalculé par `SUM(payments)` après chaque écriture. Un incrément dérive à la première anomalie (double-clic, retry réseau, suppression) ; une somme est toujours juste — la même philosophie que `remainingAmount` calculé et jamais stocké (module 07).
3. **Le journal immuable, troisième du nom.** Un paiement ne se MODIFIE pas : il s'enregistre, ou il se supprime (ADMIN) — et tout se recalcule. C'est le pattern des `stock_movements` (module 04) et des `audit_logs` (socle) : `ImmutableEntity`, pas d'`updated_at`, pas de `deleted_at`.
4. **La route statique avant la route paramétrée.** `GET /payments/overdue` et `GET /payments/:id` cohabitent : si `:id` est déclarée en premier, « overdue » est avalé comme un id (et le `ParseUUIDPipe` renvoie 400). L'ordre de déclaration des routes dans le contrôleur N'EST PAS un détail.
5. **L'agrégat de reporting.** Le résumé des impayés croise TROIS modules — factures (montants, échéances), contacts (qui relancer, à quel e-mail) et paiements (ce qui a déjà été versé) — et calcule à la volée le nombre de jours de retard. Premier écran « métier » transverse du projet, avant le tableau de bord (module 09).

**Choix assumés de cette version** (comme aux modules 05 à 07) : l'e-mail de confirmation au client lors du passage en `PAID` et l'audit (`payments.recorded`, `payments.deleted`, `invoices.paid`) sont différés au niveau min- ; les avoirs ne sont PAS « encaissables » et la compensation automatique avoir ↔ facture (netting) n'est pas traitée ici. Détail au § final.

**Convention** : un paiement stocke un montant **strictement positif**. Un remboursement client n'est pas un « paiement négatif » : c'est un avoir (module 07), et sa mécanique d'encaissement inverse attend le niveau min-.

---

## B · Ce qu'on va construire

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/payments` | ADMIN, MANAGER | Liste paginée ; filtres `invoiceId`, `method`, `from`, `to` (date de valeur) |
| `GET /api/v1/payments/overdue` | ADMIN, MANAGER | Résumé des impayés (`OVERDUE` + `PARTIALLY_PAID`), trié par reste à payer décroissant |
| `GET /api/v1/payments/:id` | ADMIN, MANAGER | Détail d'un paiement |
| `POST /api/v1/payments` | ADMIN, MANAGER | Encaisser (201) — le statut de la facture est recalculé |
| `DELETE /api/v1/payments/:id` | ADMIN | Supprimer (204) — le statut de la facture est recorrigé |

**Le cycle de vie de la facture, vu du module 08** :

```
SENT ──encaissement partiel──▶ PARTIALLY_PAID ──encaissement du solde──▶ PAID
  │                                  │
  └──────(cron 02:00, module 07)─────┴──▶ OVERDUE — reste encaissable

  (suppression d'un paiement : paidAmount et statut recalculés,
   la facture peut redescendre en PARTIALLY_PAID, OVERDUE ou SENT)
```

**Les règles métier incluses** :

- factures encaissables : type `INVOICE` uniquement (un avoir se déduit, ne s'encaisse pas) et statut `SENT`, `OVERDUE` ou `PARTIALLY_PAID` — `DRAFT` (non émise), `PAID` (déjà soldée) et `CANCELLED` sont refusées (409) ;
- montant strictement positif (validation) et jamais supérieur au reste à payer — dépassement = 409 avec le solde dans le message ;
- `paidAmount` = `SUM(payments)` recalculé à chaque enregistrement ET à chaque suppression — jamais incrémenté ;
- statut recalculé : `paidAmount ≥ totalTTC` → `PAID` ; sinon `PARTIALLY_PAID` ; après une suppression, retour possible à `SENT` (plus rien de payé) ou `OVERDUE` (échéance dépassée) ;
- paiements multiples sur la même facture : c'est le cas normal (acomptes, soldes) ;
- suppression : ADMIN uniquement — un paiement saisi par erreur se supprime, il ne se « corrige » pas ;
- `paidAt` (date de valeur) fournie par le client ou « maintenant » par défaut ;
- le résumé des impayés liste `OVERDUE` + `PARTIALLY_PAID` avec client (nom, e-mail), montants, jours de retard et paiements déjà reçus, trié par reste à payer décroissant.

**17 fichiers créés, 3 modifiés** (`app.module.ts` + la retouche au module 07 : `invoice-repository.port.ts` et `typeorm-invoice.repository.ts`), **1 migration générée**.

---

## Étape 1 — Le domaine : méthode de paiement, paiement

> Crée l'arborescence `src/modules/payments/domain/`.

### ➕ Créer `src/modules/payments/domain/payment-method.enum.ts`

```typescript
/**
 * Moyen de paiement de l'encaissement.
 * OTHER couvre les cas réels non listés (compensation, crypto, bon
 * d'achat…) — la référence libre précise alors la nature.
 */
export enum PaymentMethod {
  BankTransfer = 'BANK_TRANSFER',
  Card = 'CARD',
  Cash = 'CASH',
  Check = 'CHECK',
  Other = 'OTHER',
}
```

### ➕ Créer `src/modules/payments/domain/payment.ts`

```typescript
import { PaymentMethod } from './payment-method.enum';

/**
 * Paiement — un encaissement reçu sur une facture.
 *
 * IMMUABLE : un paiement ne se modifie jamais. Saisi par erreur, il se
 * SUPPRIME (ADMIN), et le statut de la facture est recalculé. C'est le
 * pattern du journal (stock_movements, audit_logs) : l'historique des
 * encaissements ne se réécrit pas.
 *
 * Le montant est TOUJOURS positif : un remboursement client n'est pas
 * un paiement négatif, c'est un avoir (module 07).
 */
export class Payment {
  constructor(
    public readonly id: string,
    public readonly invoiceId: string,
    /** Montant encaissé en EUR — strictement positif. */
    public readonly amount: number,
    public readonly method: PaymentMethod,
    /** Référence externe : n° de virement, n° de chèque… */
    public readonly reference: string | null,
    public readonly notes: string | null,
    /** Date de VALEUR de l'encaissement (fournie, ou « maintenant »). */
    public readonly paidAt: Date,
    /** UUID de l'utilisateur qui a saisi l'encaissement. */
    public readonly recordedBy: string,
    public readonly createdAt: Date,
  ) {}
}
```

> 💡 Pas de méthode métier sur `Payment` : toute la logique (facture encaissable, plafond du solde, recalcul du statut) vit dans les use cases, car elle fait intervenir la FACTURE — un paiement seul ne sait rien décider.

**✅ Point de contrôle** : `npm run build`

---

## Étape 2 — Le port du repository

### ➕ Créer `src/modules/payments/domain/payment-repository.port.ts`

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Payment } from './payment';
import { PaymentMethod } from './payment-method.enum';

/** Critères de listing des paiements. */
export interface ListPaymentsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  invoiceId?: string;
  method?: PaymentMethod;
  /** Bornes sur la date de VALEUR (paidAt), incluses. */
  from?: Date;
  to?: Date;
}

/** Données de création (déjà validées et résolues par le use case). */
export interface CreatePaymentData {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  recordedBy: string;
}

/** Contrat de persistance des paiements. */
export interface PaymentRepositoryPort {
  /** Liste paginée, filtrable ; tri par défaut : paidAt décroissant. */
  findAll(query: ListPaymentsQuery): Promise<PaginatedResult<Payment>>;

  /** Un paiement ; null si inconnu. */
  findById(id: string): Promise<Payment | null>;

  /** Tous les paiements d'une facture, par date de valeur croissante
   *  (l'histoire des encaissements se lit dans l'ordre). */
  findByInvoice(invoiceId: string): Promise<Payment[]>;

  /**
   * Somme des montants encaissés sur une facture, au centime.
   * LA source de vérité de paidAmount : recalculée à chaque écriture,
   * jamais incrémentée.
   */
  sumByInvoice(invoiceId: string): Promise<number>;

  /** Enregistre un paiement. */
  create(data: CreatePaymentData): Promise<Payment>;

  /** Suppression PHYSIQUE (journal corrigé par recalcul, pas par
   *  réécriture : le use case refait la somme juste après). */
  delete(id: string): Promise<void>;
}

/** Jeton d'injection du repository paiements. */
export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 3 — L'entité TypeORM et le mapper

> Crée l'arborescence `src/modules/payments/infrastructure/entities/`.

### ➕ Créer `src/modules/payments/infrastructure/entities/payment.entity.ts`

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { ImmutableEntity } from '../../../../common/entities/immutable.entity';
import { InvoiceEntity } from '../../../invoices/infrastructure/entities/invoice.entity';
import { PaymentMethod } from '../../domain/payment-method.enum';

/**
 * Entité TypeORM de la table `payments` (journal immuable).
 *
 * ImmutableEntity : id + created_at, RIEN d'autre — pas d'updated_at
 * (un paiement ne se modifie pas), pas de deleted_at (une suppression
 * ADMIN est physique, le recalcul fait foi).
 *
 * Deux index : les paiements se cherchent par facture (recalcul de
 * paidAmount, détail d'une facture) et par période (date de valeur).
 */
@Entity({ name: 'payments' })
export class PaymentEntity extends ImmutableEntity {
  @Index('IX_payments_invoice')
  @Column({ name: 'invoice_id', type: 'uniqueidentifier' })
  invoiceId!: string;

  /** FK SQL : un paiement ne peut pas pointer une facture inexistante. */
  @ManyToOne(() => InvoiceEntity)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: InvoiceEntity;

  /** Montant encaissé en EUR — de l'argent → decimal + transformer. */
  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  amount!: number;

  @Column({ name: 'method', type: 'nvarchar', length: 15 })
  method!: PaymentMethod;

  /** Référence externe (n° de virement, n° de chèque…). */
  @Column({ name: 'reference', type: 'nvarchar', length: 100, nullable: true })
  reference!: string | null;

  @Column({ name: 'notes', type: 'nvarchar', length: 500, nullable: true })
  notes!: string | null;

  /** Date de VALEUR de l'encaissement. */
  @Index('IX_payments_paid_at')
  @Column({ name: 'paid_at', type: 'datetime2' })
  paidAt!: Date;

  /**
   * UUID de l'utilisateur — simple colonne, PAS de relation vers users
   * (même choix que performedBy au module 04 : pas de couplage).
   */
  @Column({ name: 'recorded_by', type: 'uniqueidentifier' })
  recordedBy!: string;
}
```

### ➕ Créer `src/modules/payments/infrastructure/payment.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Payment } from '../domain/payment';
import { PaymentEntity } from './entities/payment.entity';

/** Conversion entité TypeORM -> modèle de domaine. */
@Injectable()
export class PaymentMapper {
  toDomain(entity: PaymentEntity): Payment {
    return new Payment(
      entity.id,
      entity.invoiceId,
      entity.amount,
      entity.method,
      entity.reference,
      entity.notes,
      entity.paidAt,
      entity.recordedBy,
      entity.createdAt,
    );
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 4 — La migration

```bash
npm run migration:generate -- src/database/migrations/CreatePaymentsTable
```

**Relis le fichier généré**. Tu dois y trouver :

- `CREATE TABLE "payments"` avec `amount decimal(12,2)`, les index `IX_payments_invoice` et `IX_payments_paid_at`, et `created_at DEFAULT getdate()` — mais NI `updated_at` NI `deleted_at` (journal immuable) ;
- **une seule `FOREIGN KEY`** : `payments.invoice_id → invoices`, SANS cascade — un paiement bloquerait la suppression physique de sa facture, et c'est très bien : seuls les BROUILLONS se suppriment (module 07), et un brouillon n'a jamais de paiement (il n'est pas encaissable) ;
- un `down()` qui défait tout ; RIEN sur les tables existantes.

```bash
npm run migration:run
npm run migration:show   # CreatePaymentsTable cochée [X]
```

**✅ Point de contrôle** : la table `payments` existe, avec ses deux index et sa FK vers `invoices`.

---

## Étape 5 — Le repository

### ➕ Créer `src/modules/payments/infrastructure/typeorm-payment.repository.ts`

Nouveauté : `sumByInvoice` — un `SELECT SUM(amount)` brut. Attention au retour : `getRawOne` ne passe PAS par le transformer de colonne (il n'hydrate pas d'entité) — la somme arrive en chaîne ou nombre selon le driver, d'où le `Number(...)`, et `roundMoney` verrouille le centime.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { roundMoney } from '../../../common/money/money';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { Payment } from '../domain/payment';
import {
  CreatePaymentData,
  ListPaymentsQuery,
  PaymentRepositoryPort,
} from '../domain/payment-repository.port';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentMapper } from './payment.mapper';

/** Liste blanche de tri. */
const PAYMENT_SORTABLE_COLUMNS: ColumnWhitelist = {
  paidAt: 'payment.paidAt',
  amount: 'payment.amount',
  method: 'payment.method',
  createdAt: 'payment.createdAt',
};

/** Implémentation TypeORM du repository paiements. */
@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepositoryPort {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repository: Repository<PaymentEntity>,
    private readonly mapper: PaymentMapper,
  ) {}

  async findAll(query: ListPaymentsQuery): Promise<PaginatedResult<Payment>> {
    const queryBuilder = this.repository.createQueryBuilder('payment');

    if (query.invoiceId !== undefined) {
      queryBuilder.andWhere('payment.invoiceId = :invoiceId', {
        invoiceId: query.invoiceId,
      });
    }
    if (query.method !== undefined) {
      queryBuilder.andWhere('payment.method = :method', {
        method: query.method,
      });
    }
    // Bornes sur la date de VALEUR : c'est elle qui a un sens pour la
    // trésorerie, pas la date technique de saisie.
    if (query.from !== undefined) {
      queryBuilder.andWhere('payment.paidAt >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('payment.paidAt <= :to', { to: query.to });
    }

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('payment.paidAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        PAYMENT_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Payment | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    const entities = await this.repository.find({
      where: { invoiceId },
      order: { paidAt: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async sumByInvoice(invoiceId: string): Promise<number> {
    // getRawOne : pas d'entité hydratée, donc pas de transformer —
    // Number() convertit ce que renvoie le driver, roundMoney verrouille.
    const raw = await this.repository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'sum')
      .where('payment.invoiceId = :invoiceId', { invoiceId })
      .getRawOne<{ sum: string | number | null }>();

    return roundMoney(Number(raw?.sum ?? 0));
  }

  async create(data: CreatePaymentData): Promise<Payment> {
    const entity = this.repository.create(data);
    const saved = await this.repository.save(entity);
    return this.mapper.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
```

> 📌 Pas de recherche textuelle ici (pas de `applySearch`) : un paiement se retrouve par sa FACTURE (`invoiceId`), sa méthode ou sa période — chercher « du texte » dans un journal d'encaissements n'a pas de cas d'usage réel au niveau mini.

**✅ Point de contrôle** : `npm run build`

---

## Étape 6 — La retouche au module 07

Le module 07 avait été conçu pour ce moment : `paidAmount` existe en base (défaut 0), les statuts `PARTIALLY_PAID`/`PAID` existent dans l'enum — mais l'interface de modification ne les expose pas encore, et le résumé des impayés a besoin d'une requête dédiée. Deux fichiers du module 07 à retoucher, AUCUN comportement existant ne change.

### ✏️ Modifier `src/modules/invoices/domain/invoice-repository.port.ts`

**1)** Dans l'interface `UpdateInvoiceData`, ajoute `paidAmount` (et mets à jour le commentaire de l'interface — la dette du 07 est soldée) :

**AVANT** :

```typescript
/**
 * Champs modifiables (DRAFT uniquement, garanti par le use case).
 * status est piloté par les transitions ; paidAmount attendra le 08.
 */
export interface UpdateInvoiceData {
```

**APRÈS** :

```typescript
/**
 * Champs modifiables (DRAFT uniquement, garanti par le use case).
 * status est piloté par les transitions ; paidAmount par le module 08
 * (paiements) — jamais par l'API de modification publique.
 */
export interface UpdateInvoiceData {
```

puis, dans le corps de l'interface, après `status?: InvoiceStatus;` :

```typescript
  /** Posé EXCLUSIVEMENT par le module 08 : somme des paiements. */
  paidAmount?: number;
```

**2)** Dans l'interface `InvoiceRepositoryPort`, ajoute la requête du résumé des impayés (après `findOverdue`) :

```typescript
  /**
   * Factures impayées (OVERDUE + PARTIALLY_PAID), client joint, triées
   * par reste à payer décroissant — le résumé du module 08.
   */
  findUnpaid(query: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<Invoice>>;
```

### ✏️ Modifier `src/modules/invoices/infrastructure/typeorm-invoice.repository.ts`

Ajoute l'implémentation, après `findOverdue` :

```typescript
  async findUnpaid(query: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<Invoice>> {
    const queryBuilder = this.repository
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.customer', 'customer')
      .where('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.Overdue, InvoiceStatus.PartiallyPaid],
      })
      // Reste à payer décroissant : les plus gros impayés d'abord.
      // Expression SQL brute : noms de COLONNES (total_ttc), pas de
      // propriétés — orderBy ne traduit pas les expressions.
      .orderBy('(invoice.total_ttc - invoice.paid_amount)', 'DESC');

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
```

> 💡 `INVOICE_REPOSITORY` et `GetInvoiceByIdUseCase` sont DÉJÀ exportés par `invoices.module.ts` (le module 07 annonçait « module 08, paiements » dans son commentaire d'exports) : aucune retouche d'export nécessaire cette fois.

**✅ Point de contrôle** : `npm run build`

---

## Étape 7 — Les cas d'utilisation (5)

> Crée le dossier `src/modules/payments/application/`.

### ➕ Créer `src/modules/payments/application/list-payments.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Payment } from '../domain/payment';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type {
  ListPaymentsQuery,
  PaymentRepositoryPort,
} from '../domain/payment-repository.port';

/** Cas d'utilisation : lister les paiements (pagination + filtres). */
@Injectable()
export class ListPaymentsUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
  ) {}

  execute(query: ListPaymentsQuery): Promise<PaginatedResult<Payment>> {
    return this.paymentRepository.findAll(query);
  }
}
```

### ➕ Créer `src/modules/payments/application/get-payment-by-id.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Payment } from '../domain/payment';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';

/** Cas d'utilisation : récupérer un paiement (404 si inconnu). */
@Injectable()
export class GetPaymentByIdUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
  ) {}

  async execute(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new ResourceNotFoundException('Le paiement');
    }
    return payment;
  }
}
```

### ➕ Créer `src/modules/payments/application/record-payment.use-case.ts`

**LE cas d'utilisation du module.** Toutes les vérifications AVANT la première écriture (modules 04/06 : si ça refuse, RIEN n'a bougé), puis écriture, puis RECALCUL.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetInvoiceByIdUseCase } from '../../invoices/application/get-invoice-by-id.use-case';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { InvoiceStatus } from '../../invoices/domain/invoice-status.enum';
import { InvoiceType } from '../../invoices/domain/invoice-type.enum';
import { Payment } from '../domain/payment';
import { PaymentMethod } from '../domain/payment-method.enum';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';

/** Statuts de facture qui acceptent un encaissement. */
const PAYABLE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.Sent,
  InvoiceStatus.Overdue,
  InvoiceStatus.PartiallyPaid,
];

/** Données d'encaissement (déjà validées par le DTO). */
export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  /** Date de valeur ISO ; absente = maintenant. */
  paidAt?: string;
}

/**
 * Cas d'utilisation : enregistrer un encaissement.
 *
 * Règles :
 *   - la facture doit exister (404), être de type INVOICE (un avoir se
 *     déduit, ne s'encaisse pas) et être ÉMISE non soldée (SENT,
 *     OVERDUE ou PARTIALLY_PAID) ;
 *   - le montant ne peut pas dépasser le reste à payer (409, solde
 *     dans le message) ;
 *   - après création : paidAmount = SUM(payments) — RECALCULÉ, jamais
 *     incrémenté — puis statut PAID (soldée) ou PARTIALLY_PAID.
 *
 * L'e-mail de confirmation au client (passage en PAID) est branché au
 * niveau min- — le recalcul, lui, ne changera pas.
 */
@Injectable()
export class RecordPaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: RecordPaymentInput,
  ): Promise<Payment> {
    const invoice = await this.getInvoiceByIdUseCase.execute(input.invoiceId);

    if (invoice.type !== InvoiceType.Invoice) {
      throw new BusinessRuleViolationException(
        `${invoice.number} est un avoir : un avoir se déduit d'une ` +
          "facture, il ne s'encaisse pas.",
      );
    }
    if (!PAYABLE_STATUSES.includes(invoice.status)) {
      throw new BusinessRuleViolationException(
        `La facture ${invoice.number} (statut ${invoice.status}) ne peut ` +
          'pas recevoir de paiement : seules les factures SENT, OVERDUE ' +
          'ou PARTIALLY_PAID sont encaissables.',
      );
    }

    const remaining = invoice.remainingAmount();
    if (input.amount > remaining) {
      throw new BusinessRuleViolationException(
        `Le montant (${input.amount} €) dépasse le solde restant de la ` +
          `facture ${invoice.number} (${remaining} €).`,
      );
    }

    const payment = await this.paymentRepository.create({
      invoiceId: invoice.id,
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      recordedBy: actor.userId,
    });

    // SOURCE DE VÉRITÉ : la somme du journal, pas un incrément.
    const paidAmount = await this.paymentRepository.sumByInvoice(invoice.id);
    const status =
      paidAmount >= invoice.totalTTC
        ? InvoiceStatus.Paid
        : InvoiceStatus.PartiallyPaid;

    await this.invoiceRepository.update(invoice.id, { paidAmount, status });

    return payment;
  }
}
```

> 📌 **Pourquoi la comparaison `paidAmount >= invoice.totalTTC` est fiable en flottants ?** Parce que TOUT est arrondi au centime à chaque étape (`roundMoney` : montants des lignes, totaux, somme des paiements) et que le montant est plafonné au solde : au moment du solde exact, les deux valeurs sont le MÊME nombre décimal à deux chiffres — l'égalité tombe juste.

### ➕ Créer `src/modules/payments/application/delete-payment.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { GetInvoiceByIdUseCase } from '../../invoices/application/get-invoice-by-id.use-case';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { InvoiceStatus } from '../../invoices/domain/invoice-status.enum';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';
import { GetPaymentByIdUseCase } from './get-payment-by-id.use-case';

/**
 * Cas d'utilisation : supprimer un paiement (saisie erronée) — réservé
 * ADMIN (contrôleur).
 *
 * Après suppression, TOUT est recalculé, comme à l'enregistrement :
 *   - paidAmount = SUM(payments) restants ;
 *   - statut recorrigé : PAID si (encore) soldée, sinon OVERDUE si
 *     l'échéance est dépassée (le cron du 07 l'aurait reposé cette
 *     nuit — autant être juste tout de suite), sinon PARTIALLY_PAID
 *     s'il reste des encaissements, sinon retour à SENT.
 */
@Injectable()
export class DeletePaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getPaymentByIdUseCase: GetPaymentByIdUseCase,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(paymentId: string): Promise<void> {
    const payment = await this.getPaymentByIdUseCase.execute(paymentId);
    const invoice = await this.getInvoiceByIdUseCase.execute(
      payment.invoiceId,
    );

    await this.paymentRepository.delete(paymentId);

    const paidAmount = await this.paymentRepository.sumByInvoice(invoice.id);

    let status: InvoiceStatus;
    if (paidAmount >= invoice.totalTTC) {
      status = InvoiceStatus.Paid;
    } else if (invoice.dueDate < new Date()) {
      status = InvoiceStatus.Overdue;
    } else if (paidAmount > 0) {
      status = InvoiceStatus.PartiallyPaid;
    } else {
      status = InvoiceStatus.Sent;
    }

    await this.invoiceRepository.update(invoice.id, { paidAmount, status });
  }
}
```

### ➕ Créer `src/modules/payments/application/get-overdue-summary.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { GetContactByIdUseCase } from '../../contact/application/get-contact-by-id.use-case';
import { Invoice } from '../../invoices/domain/invoice';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { Payment } from '../domain/payment';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';

/** Une ligne du résumé : la facture, son client, son retard, ses paiements. */
export interface OverdueInvoiceSummary {
  invoice: Invoice;
  /** E-mail du client — la donnée qui manque au domaine Invoice
   *  (customerName seul), indispensable pour relancer. */
  customerEmail: string | null;
  /** Jours de retard, entiers ; 0 si l'échéance n'est pas dépassée
   *  (cas PARTIALLY_PAID encore dans les temps). */
  daysOverdue: number;
  /** Encaissements déjà reçus, par date de valeur croissante. */
  payments: Payment[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Cas d'utilisation : le résumé des impayés — les factures OVERDUE et
 * PARTIALLY_PAID, triées par reste à payer décroissant (les plus gros
 * trous de trésorerie d'abord), avec de quoi relancer : le client
 * (nom + e-mail), le retard en jours, l'historique des encaissements.
 *
 * Croise TROIS modules (factures, contacts, paiements) : c'est un
 * agrégat de LECTURE — aucune écriture, aucune règle d'état.
 */
@Injectable()
export class GetOverdueSummaryUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
  ) {}

  async execute(query: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<OverdueInvoiceSummary>> {
    const result = await this.invoiceRepository.findUnpaid(query);
    const now = new Date();

    const items: OverdueInvoiceSummary[] = [];
    for (const invoice of result.items) {
      const contact = await this.getContactByIdUseCase.execute(
        invoice.customerId,
      );
      const payments = await this.paymentRepository.findByInvoice(invoice.id);

      items.push({
        invoice,
        customerEmail: contact.email,
        daysOverdue: Math.max(
          0,
          Math.floor((now.getTime() - invoice.dueDate.getTime()) / MS_PER_DAY),
        ),
        payments,
      });
    }

    return { items, meta: result.meta };
  }
}
```

> 💡 Oui, la boucle fait des requêtes par facture (client + paiements) : sur une PAGE (20 lignes par défaut), c'est parfaitement acceptable — et lisible. La version optimisée (jointures uniques) est une affaire de niveau min-, si le besoin apparaît.

**✅ Point de contrôle** : `npm run build`

---

## Étape 8 — Les DTOs

> Crée le dossier `src/modules/payments/presentation/dto/`.

### ➕ Créer `src/modules/payments/presentation/dto/record-payment.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '../../domain/payment-method.enum';

/** Corps de POST /payments. */
export class RecordPaymentDto {
  @ApiProperty({ description: 'Facture encaissée (SENT, OVERDUE ou PARTIALLY_PAID).' })
  @IsUUID(undefined, {
    message: "L'invoiceId doit être un UUID valide.",
  })
  invoiceId!: string;

  @ApiProperty({
    description: 'Montant encaissé en EUR — au plus le reste à payer.',
    example: 500,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le montant doit être un nombre (2 décimales max).' },
  )
  @IsPositive({ message: 'Le montant doit être strictement positif.' })
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.BankTransfer })
  @IsEnum(PaymentMethod, {
    message:
      'La méthode doit valoir BANK_TRANSFER, CARD, CASH, CHECK ou OTHER.',
  })
  method!: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Référence externe (n° de virement, n° de chèque…).',
    example: 'VIR-2026-07-1842',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'La référence ne peut pas dépasser 100 caractères.',
  })
  reference?: string;

  @ApiPropertyOptional({ example: 'Acompte de 50 % à la commande.' })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Les notes ne peuvent pas dépasser 500 caractères.',
  })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Date de VALEUR (ISO 8601). Défaut : maintenant.',
    example: '2026-07-17',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Le champ "paidAt" doit être une date ISO.' },
  )
  paidAt?: string;
}
```

### ➕ Créer `src/modules/payments/presentation/dto/list-payments-query.dto.ts`

```typescript
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { PaymentMethod } from '../../domain/payment-method.enum';

/**
 * Query string de GET /payments — pagination + plage de dates (from/to
 * sur la date de VALEUR paidAt) via IntersectionType.
 */
export class ListPaymentsQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ description: 'Filtre par facture.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "invoiceId" doit être un UUID valide.',
  })
  invoiceId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message:
      'La méthode doit valoir BANK_TRANSFER, CARD, CASH, CHECK ou OTHER.',
  })
  method?: PaymentMethod;
}
```

### ➕ Créer `src/modules/payments/presentation/dto/payment-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Payment } from '../../domain/payment';
import { PaymentMethod } from '../../domain/payment-method.enum';

/** Représentation publique d'un paiement. */
export class PaymentResponseDto {
  @ApiProperty({ description: 'Identifiant du paiement (UUID).' })
  id!: string;

  @ApiProperty({ description: 'Facture encaissée.' })
  invoiceId!: string;

  @ApiProperty({ example: 500 })
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  method!: PaymentMethod;

  @ApiProperty({ nullable: true, example: 'VIR-2026-07-1842' })
  reference!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'Date de valeur.' })
  paidAt!: Date;

  @ApiProperty({ description: 'UUID du saisisseur.' })
  recordedBy!: string;

  @ApiProperty()
  createdAt!: Date;

  static fromDomain(payment: Payment): PaymentResponseDto {
    const dto = new PaymentResponseDto();
    dto.id = payment.id;
    dto.invoiceId = payment.invoiceId;
    dto.amount = payment.amount;
    dto.method = payment.method;
    dto.reference = payment.reference;
    dto.notes = payment.notes;
    dto.paidAt = payment.paidAt;
    dto.recordedBy = payment.recordedBy;
    dto.createdAt = payment.createdAt;
    return dto;
  }
}
```

### ➕ Créer `src/modules/payments/presentation/dto/overdue-invoice-summary.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { OverdueInvoiceSummary } from '../../application/get-overdue-summary.use-case';
import { PaymentResponseDto } from './payment-response.dto';

/** Le client à relancer. */
export class OverdueCustomerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'ACME Industries' })
  companyName!: string;

  @ApiProperty({ nullable: true, example: 'compta@acme-industries.fr' })
  email!: string | null;
}

/**
 * Une ligne du résumé des impayés : la facture, le client à relancer,
 * le retard et les encaissements déjà reçus.
 */
export class OverdueInvoiceSummaryDto {
  @ApiProperty({ description: 'Identifiant de la facture (UUID).' })
  invoiceId!: string;

  @ApiProperty({ example: 'FAC-2026-0001' })
  invoiceNumber!: string;

  @ApiProperty({ type: OverdueCustomerDto })
  customer!: OverdueCustomerDto;

  @ApiProperty({ example: 1094.76 })
  totalTTC!: number;

  @ApiProperty({ example: 500 })
  paidAmount!: number;

  @ApiProperty({ description: 'Reste à payer (TTC - payé).', example: 594.76 })
  remainingAmount!: number;

  @ApiProperty({ description: "Date d'échéance." })
  dueDate!: Date;

  @ApiProperty({
    description: 'Jours de retard (0 si l’échéance n’est pas dépassée).',
    example: 12,
  })
  daysOverdue!: number;

  @ApiProperty({ type: [PaymentResponseDto] })
  payments!: PaymentResponseDto[];

  static fromSummary(summary: OverdueInvoiceSummary): OverdueInvoiceSummaryDto {
    const dto = new OverdueInvoiceSummaryDto();
    dto.invoiceId = summary.invoice.id;
    dto.invoiceNumber = summary.invoice.number;
    dto.customer = {
      id: summary.invoice.customerId,
      companyName: summary.invoice.customerName,
      email: summary.customerEmail,
    };
    dto.totalTTC = summary.invoice.totalTTC;
    dto.paidAmount = summary.invoice.paidAmount;
    dto.remainingAmount = summary.invoice.remainingAmount();
    dto.dueDate = summary.invoice.dueDate;
    dto.daysOverdue = summary.daysOverdue;
    dto.payments = summary.payments.map(PaymentResponseDto.fromDomain);
    return dto;
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 9 — Le contrôleur

### ➕ Créer `src/modules/payments/presentation/payments.controller.ts`

**ATTENTION À L'ORDRE DES ROUTES** : `GET overdue` est déclarée AVANT `GET :id`. NestJS enregistre les routes dans l'ordre de déclaration de la classe — déclarée après, « overdue » serait capté par `:id` et le `ParseUUIDPipe` renverrait 400.

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
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { DeletePaymentUseCase } from '../application/delete-payment.use-case';
import { GetOverdueSummaryUseCase } from '../application/get-overdue-summary.use-case';
import { GetPaymentByIdUseCase } from '../application/get-payment-by-id.use-case';
import { ListPaymentsUseCase } from '../application/list-payments.use-case';
import { RecordPaymentUseCase } from '../application/record-payment.use-case';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { OverdueInvoiceSummaryDto } from './dto/overdue-invoice-summary.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

/**
 * Contrôleur des paiements.
 * Tout est ADMIN/MANAGER (les encaissements sont de la gestion, pas de
 * la consultation d'équipe) ; la suppression est ADMIN seul.
 */
@ApiTags('Paiements')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly listPaymentsUseCase: ListPaymentsUseCase,
    private readonly getPaymentByIdUseCase: GetPaymentByIdUseCase,
    private readonly recordPaymentUseCase: RecordPaymentUseCase,
    private readonly deletePaymentUseCase: DeletePaymentUseCase,
    private readonly getOverdueSummaryUseCase: GetOverdueSummaryUseCase,
  ) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Liste paginée des paiements',
    description:
      'Filtres : invoiceId, method, from/to (date de VALEUR, ISO). ' +
      'Tri par défaut : paidAt décroissant.',
  })
  @ApiOkResponse({ type: [PaymentResponseDto] })
  async list(
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaginatedResult<PaymentResponseDto>> {
    const result = await this.listPaymentsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      invoiceId: query.invoiceId,
      method: query.method,
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(PaymentResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  // DÉCLARÉE AVANT :id — sinon « overdue » serait avalé comme un id.
  @Get('overdue')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Résumé des impayés',
    description:
      'Factures OVERDUE + PARTIALLY_PAID, triées par reste à payer ' +
      'décroissant, avec client (nom, e-mail), jours de retard et ' +
      'paiements déjà reçus.',
  })
  @ApiOkResponse({ type: [OverdueInvoiceSummaryDto] })
  async overdueSummary(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<OverdueInvoiceSummaryDto>> {
    const result = await this.getOverdueSummaryUseCase.execute({
      page: query.page,
      limit: query.limit,
    });

    return {
      items: result.items.map(OverdueInvoiceSummaryDto.fromSummary),
      meta: result.meta,
    };
  }

  @Get(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: "Détail d'un paiement" })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({ description: 'Paiement inconnu.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.getPaymentByIdUseCase.execute(id);
    return PaymentResponseDto.fromDomain(payment);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Enregistrer un encaissement',
    description:
      'Facture SENT, OVERDUE ou PARTIALLY_PAID uniquement ; montant ' +
      'plafonné au reste à payer. paidAmount et statut de la facture ' +
      'recalculés (PARTIALLY_PAID, ou PAID si soldée).',
  })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({ description: 'Facture inconnue.' })
  @ApiConflictResponse({
    description:
      'Facture non encaissable (brouillon, soldée, annulée, avoir) ou ' +
      'montant supérieur au solde.',
  })
  async record(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordPaymentDto,
  ): Promise<PaymentResponseDto> {
    const payment = await this.recordPaymentUseCase.execute(user, body);
    return PaymentResponseDto.fromDomain(payment);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un paiement (saisie erronée)',
    description:
      'ADMIN uniquement. paidAmount et statut de la facture recalculés ' +
      '(retour possible à SENT, OVERDUE ou PARTIALLY_PAID).',
  })
  @ApiNoContentResponse({ description: 'Paiement supprimé.' })
  @ApiNotFoundResponse({ description: 'Paiement inconnu.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deletePaymentUseCase.execute(id);
  }
}
```

**À retenir :**
- **`GET overdue` avant `GET :id`** : l'ordre de déclaration EST le routage.
- Le résumé des impayés prend une simple `PaginationQueryDto` (pas de filtres : c'est un écran, pas un moteur de recherche).

**✅ Point de contrôle** : `npm run build`

---

## Étape 10 — Le module + AppModule

### ➕ Créer `src/modules/payments/payments.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsModule } from '../contact/contacts.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { DeletePaymentUseCase } from './application/delete-payment.use-case';
import { GetOverdueSummaryUseCase } from './application/get-overdue-summary.use-case';
import { GetPaymentByIdUseCase } from './application/get-payment-by-id.use-case';
import { ListPaymentsUseCase } from './application/list-payments.use-case';
import { RecordPaymentUseCase } from './application/record-payment.use-case';
import { PAYMENT_REPOSITORY } from './domain/payment-repository.port';
import { PaymentEntity } from './infrastructure/entities/payment.entity';
import { PaymentMapper } from './infrastructure/payment.mapper';
import { TypeOrmPaymentRepository } from './infrastructure/typeorm-payment.repository';
import { PaymentsController } from './presentation/payments.controller';

/**
 * Module des paiements.
 *
 * Imports :
 *   - InvoicesModule : GetInvoiceByIdUseCase + INVOICE_REPOSITORY (le
 *     statut des factures est piloté d'ici — la promesse du 07) ;
 *   - ContactsModule : GetContactByIdUseCase (e-mail du client dans le
 *     résumé des impayés).
 *
 * PAYMENT_REPOSITORY est exporté : le module 09 (tableau de bord)
 * agrégera les encaissements.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
    InvoicesModule,
    ContactsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentMapper,
    ListPaymentsUseCase,
    GetPaymentByIdUseCase,
    RecordPaymentUseCase,
    DeletePaymentUseCase,
    GetOverdueSummaryUseCase,
    {
      provide: PAYMENT_REPOSITORY,
      useClass: TypeOrmPaymentRepository,
    },
  ],
  exports: [PAYMENT_REPOSITORY],
})
export class PaymentsModule {}
```

### ✏️ Modifier `src/app.module.ts`

**1)** Ajoute l'import :

```typescript
import { PaymentsModule } from './modules/payments/payments.module';
```

**2)** Dans le tableau `imports`, après `InvoicesModule` :

```typescript
    OrdersModule,
    InvoicesModule,
    PaymentsModule,
    AuthenticationModule,
```

**✅ Point de contrôle** :

```bash
npm run build
npm run start:dev
```

Les logs listent les 5 routes `/api/v1/payments*` ; Swagger affiche la section « Paiements ».

---

## Étape 11 — Vérifier que ça marche & ce qu'on verra plus tard

### 11.1 Parcours manuel (PowerShell)

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion + prérequis : client, produit, facture ÉMISE
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

$client = Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"type":"CUSTOMER","companyName":"ACME Industries","email":"compta@acme-industries.fr"}'
$prod = Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Écran Dell 27\" QHD","type":"PRODUCT","unit":"UNIT","unitPrice":349.90}'

$fac = Invoke-RestMethod -Method Post -Uri "$base/invoices" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"customerId":"' + $client.data.id + '",' +
         '"lines":[' +
         '{"productId":"' + $prod.data.id + '","quantity":2},' +
         '{"description":"Installation sur site","quantity":2.5,"unitPrice":85}' +
         ']}')
Invoke-RestMethod -Method Post -Uri "$base/invoices/$($fac.data.id)/send" -Headers $headers | Out-Null
$fac.data.totalTTC   # → 1094.76

# 2. Payer une facture NON émise → 409 (crée un brouillon pour le test)
$draft = Invoke-RestMethod -Method Post -Uri "$base/invoices" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"customerId":"' + $client.data.id + '","lines":[{"description":"Test","quantity":1,"unitPrice":10}]}')
try {
  Invoke-RestMethod -Method Post -Uri "$base/payments" -Headers $headers `
    -ContentType 'application/json' `
    -Body ('{"invoiceId":"' + $draft.data.id + '","amount":10,"method":"CASH"}')
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 3. Encaissement PARTIEL : 500 € par virement
$p1 = Invoke-RestMethod -Method Post -Uri "$base/payments" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"invoiceId":"' + $fac.data.id + '","amount":500,"method":"BANK_TRANSFER","reference":"VIR-2026-07-1842"}')

# 4. La facture a basculé TOUTE SEULE
$check = Invoke-RestMethod -Uri "$base/invoices/$($fac.data.id)" -Headers $headers
$check.data.status            # → PARTIALLY_PAID
$check.data.paidAmount        # → 500
$check.data.remainingAmount   # → 594.76

# 5. Dépasser le solde → 409, le message donne le reste à payer
try {
  Invoke-RestMethod -Method Post -Uri "$base/payments" -Headers $headers `
    -ContentType 'application/json' `
    -Body ('{"invoiceId":"' + $fac.data.id + '","amount":600,"method":"CARD"}')
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 6. Solder : 594.76 → la facture passe PAID
$p2 = Invoke-RestMethod -Method Post -Uri "$base/payments" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"invoiceId":"' + $fac.data.id + '","amount":594.76,"method":"CHECK","reference":"CHQ 0004521"}')
(Invoke-RestMethod -Uri "$base/invoices/$($fac.data.id)" -Headers $headers).data.status
# → PAID (remainingAmount : 0)

# 7. Payer une facture SOLDÉE → 409
try {
  Invoke-RestMethod -Method Post -Uri "$base/payments" -Headers $headers `
    -ContentType 'application/json' `
    -Body ('{"invoiceId":"' + $fac.data.id + '","amount":1,"method":"CASH"}')
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 8. SUPPRIMER le solde (ADMIN) : tout se recalcule en sens inverse
Invoke-WebRequest -Method Delete -Uri "$base/payments/$($p2.data.id)" `
  -Headers $headers | Select-Object StatusCode    # → 204
$check = Invoke-RestMethod -Uri "$base/invoices/$($fac.data.id)" -Headers $headers
$check.data.status            # → PARTIALLY_PAID (500 restants au journal)
$check.data.remainingAmount   # → 594.76

# 9. Lister les paiements de la facture (l'histoire des encaissements)
Invoke-RestMethod -Uri "$base/payments?invoiceId=$($fac.data.id)" -Headers $headers |
  ConvertTo-Json -Depth 5

# 10. Le résumé des impayés (la facture y figure : PARTIALLY_PAID)
Invoke-RestMethod -Uri "$base/payments/overdue" -Headers $headers |
  ConvertTo-Json -Depth 6
# → invoiceNumber, customer { companyName, email }, remainingAmount,
#   daysOverdue (0 : l'échéance n'est pas dépassée), payments[]
```

Même parcours possible à la souris dans **Swagger**, ou via la collection **`postman-08-paiements.json`**.

> 💡 **Tester `daysOverdue` > 0 et le statut OVERDUE sans attendre** : pose une échéance passée directement en SQL (`UPDATE invoices SET due_date = '2026-01-01' WHERE number = 'FAC-2026-0001'`), attends le cron de 02:00 — ou appelle `execute()` de `CheckOverdueInvoicesTask` (module 07) depuis un test. Le résumé affichera alors le retard en jours.

### 11.2 Les pièges croisés en route (mémo)

| Piège | Parade |
|---|---|
| `GET /payments/overdue` capté par `GET /payments/:id` (400 UUID) | Déclarer la route STATIQUE avant la route PARAMÉTRÉE |
| `paidAmount += amount` (dérive au premier retry/double-clic) | TOUJOURS recalculé : `paidAmount = SUM(payments)` |
| Comparer des flottants pour décider PAID | Tout est arrondi au centime (`roundMoney`) + montant plafonné au solde : l'égalité tombe juste |
| Encaisser un avoir | 409 : un avoir se déduit, il ne s'encaisse pas |
| Supprimer un paiement laisse la facture PAID | Recalcul complet après suppression : PAID / OVERDUE / PARTIALLY_PAID / SENT |
| `SUM()` qui ignore le transformer de colonne | `getRawOne` n'hydrate pas d'entité : `Number(raw.sum ?? 0)` + `roundMoney` |
| Paiement partiel sur facture en retard « cache » le retard | Assumé : statut PARTIALLY_PAID posé, le cron du 07 re-marquera OVERDUE à 02:00 (il surveille aussi PARTIALLY_PAID) |
| Modifier un paiement saisi de travers | Jamais : journal immuable — on supprime (ADMIN) et on ressaisit |

### 11.3 Ce qu'on verra plus tard (rien n'est perdu)

| Différé | Pourquoi ce n'est pas bloquant | Niveau |
|---|---|---|
| **E-mail de confirmation** au client (passage en PAID) | Le statut bascule déjà ; le mail se branchera dans RecordPayment sans changer le recalcul | 🟡 min- |
| **Audit** (`payments.recorded`, `payments.deleted`, `invoices.paid`) | `recordedBy` trace déjà le saisisseur ; le journal central est un plus | 🟡 min- |
| **Netting avoir ↔ facture** (déduire les avoirs du reste à payer) | Les avoirs existent et sont tracés (module 07) ; la compensation automatique est une règle comptable à part entière | 🟡 min- |
| **Relances automatiques** des impayés (e-mails planifiés) | Le résumé des impayés donne déjà qui relancer, combien, depuis quand | 🟡 min- |
| **Résumé optimisé** (jointures uniques au lieu de la boucle par page) | Parfaitement fluide à l'échelle d'une page de 20 lignes | 🟡 min- |
| **Tests** (unit : plafond du solde, recalcul après suppression, PAID exact ; e2e : partiel → solde → PAID) | L'application fonctionne ; garantie long terme | 🔴 complet |

### 11.4 Ce que ce module t'a appris de nouveau

1. **Fermer une boucle inter-modules** : des états déclarés « pour plus tard » au module 07 (`PARTIALLY_PAID`, `PAID`, `paidAmount`) prennent vie ici, sans qu'une ligne du 07 ne change de comportement — seule son interface s'est ouverte (`paidAmount` modifiable, `findUnpaid`).
2. **Le recalcul comme source de vérité** : une somme se refait, un incrément se corrompt — `SUM(payments)` à chaque écriture, dans les deux sens (ajout ET suppression).
3. **Le journal immuable, généralisé** : après les mouvements de stock et les audit logs, les encaissements — troisième usage d'`ImmutableEntity`, même philosophie (on n'édite pas l'histoire).
4. **L'ordre de déclaration des routes** : `overdue` avant `:id`, ou 400 assuré — le routage NestJS lit la classe de haut en bas.
5. **L'agrégat de reporting multi-modules** : factures + contacts + paiements croisés EN LECTURE, calculs à la volée (`daysOverdue`, `remainingAmount`) — l'échauffement idéal avant le tableau de bord (module 09).

---

*Fin du guide mini-DEV-08. Prochain module : le tableau de bord (09) — indicateurs d'activité, chiffre d'affaires, impayés et stock agrégés en un écran.*
