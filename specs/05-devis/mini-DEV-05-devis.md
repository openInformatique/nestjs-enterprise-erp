# mini-DEV-05 · Devis — l'essentiel pour démarrer

> **Spec couverte** : `specs/05-devis/05-devis.md` (version minimale)
> **Niveau** : 🟢 fonctionnel — même logique que les `mini-DEV-01` à `04` (voir `RECAP-DEV-01` pour la philosophie des 3 niveaux).
> **Prérequis** : `mini-DEV-01` (rôles), `mini-DEV-02` (contacts = les clients) et `mini-DEV-03` (produits). Le module 04 n'est pas nécessaire.
> **Promesse** : à la fin, des devis complets — numérotés automatiquement (`DEV-2026-0001`), avec lignes produit ou lignes libres, remises, totaux HT/TVA/TTC calculés au centime près, un **cycle de vie strict** (brouillon → envoyé → accepté/refusé/expiré) et une **tâche planifiée** qui fait expirer les devis dépassés chaque nuit. 8 routes dans Swagger. Environ 3 h 30.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — L'arrondi monétaire (dans `common/`)](#étape-1--larrondi-monétaire-dans-common)
- [Étape 2 — Le domaine : statuts, lignes, devis, totaux](#étape-2--le-domaine--statuts-lignes-devis-totaux)
- [Étape 3 — Le port du repository](#étape-3--le-port-du-repository)
- [Étape 4 — Les entités TypeORM et le mapper](#étape-4--les-entités-typeorm-et-le-mapper)
- [Étape 5 — La migration](#étape-5--la-migration)
- [Étape 6 — Le repository](#étape-6--le-repository)
- [Étape 7 — Les cas d'utilisation (9)](#étape-7--les-cas-dutilisation-9)
- [Étape 8 — La tâche planifiée](#étape-8--la-tâche-planifiée)
- [Étape 9 — Les DTOs](#étape-9--les-dtos)
- [Étape 10 — Le contrôleur](#étape-10--le-contrôleur)
- [Étape 11 — Le module + AppModule](#étape-11--le-module--appmodule)
- [Étape 12 — Vérifier que ça marche & ce qu'on verra plus tard](#étape-12--vérifier-que-ça-marche--ce-quon-verra-plus-tard)

---

## 0 · Avant de commencer

- API démarrée, base à jour, `admin@local.dev` en ADMIN, tables `contacts` et `products` présentes (modules 02 et 03 appliqués).
- Pour les rappels sur le socle : section A de `mini-DEV-01`.

### Les nouveautés de ce module

1. **L'agrégat parent-enfants.** Un devis N'EXISTE PAS sans ses lignes : elles se créent avec lui (cascade d'insertion TypeORM), se remplacent avec lui, et disparaissent avec lui (`ON DELETE CASCADE` en SQL). Première relation `@OneToMany`.
2. **La machine à états.** Un devis suit un cycle de vie STRICT : `DRAFT → SENT → ACCEPTED | REJECTED | EXPIRED`. Chaque transition est un use case qui refuse (409) tout état de départ invalide — un devis accepté n'est plus jamais modifiable, comme dans la vraie vie.
3. **L'arithmétique monétaire.** On multiplie enfin des montants (quantité × prix × remise) — et en JavaScript, `0.1 + 0.2 = 0.30000000000000004`. La parade : arrondir au centime après CHAQUE opération, avec un helper commun (`roundMoney`) que les modules 06 à 08 réutiliseront.
4. **Les DTOs imbriqués.** Le corps de création contient un TABLEAU de lignes : découverte de `@ValidateNested` + `@Type` pour que le ValidationPipe descende valider chaque ligne.
5. **La tâche planifiée.** Un cron nocturne passe en `EXPIRED` les devis envoyés dont la date de validité est dépassée — même pattern que la purge de sessions du socle.
6. **Le figement des prix.** Une ligne COPIE le nom et le prix du produit au moment de la création : si le prix catalogue change demain, le devis d'hier ne bouge pas. C'est voulu, et c'est fondamental.

**Choix assumés de cette version** : le PDF et l'envoi d'e-mail au client sont différés (l'action « envoyer » ne fait QUE la transition de statut) ; la conversion en commande attend le module 06. Détail au § final.

---

## B · Ce qu'on va construire

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/quotes` | tout connecté | Liste paginée ; filtres `status`, `customerId`, `from`, `to`, `search` (n° / client) |
| `GET /api/v1/quotes/:id` | tout connecté | Détail avec lignes et nom du client |
| `POST /api/v1/quotes` | tout connecté | Créer (statut DRAFT, numéro auto, totaux calculés) |
| `PATCH /api/v1/quotes/:id` | ADMIN, MANAGER | Modifier — **DRAFT uniquement** (409 sinon) |
| `DELETE /api/v1/quotes/:id` | ADMIN | Supprimer — **DRAFT uniquement** (409 sinon, 204) |
| `POST /api/v1/quotes/:id/send` | ADMIN, MANAGER | DRAFT → SENT |
| `POST /api/v1/quotes/:id/accept` | ADMIN, MANAGER | SENT → ACCEPTED |
| `POST /api/v1/quotes/:id/reject` | ADMIN, MANAGER | SENT → REJECTED |

**Les règles métier incluses** :

- le client doit être un contact de type `CUSTOMER` ou `BOTH` (un fournisseur ne reçoit pas de devis) ;
- une ligne référence un produit ACTIF du catalogue (description/prix/TVA copiés si non fournis) OU est une ligne libre (description + prix alors obligatoires) ;
- remise par ligne (0–100 %), TVA par ligne (0, 5.5, 10, 20), quantités décimales acceptées (2.5 h de main-d'œuvre) ;
- totaux recalculés CÔTÉ SERVEUR à chaque écriture — jamais confiés au client ;
- numérotation séquentielle par année : `DEV-2026-0001`, `DEV-2026-0002`… (unique en base) ;
- modification et suppression réservées au statut `DRAFT` ; transitions strictes partout ailleurs ;
- `validUntil` par défaut : aujourd'hui + 30 jours ; chaque nuit à 1 h, les devis `SENT` dépassés passent en `EXPIRED`.

**28 fichiers créés, 1 modifié** (`app.module.ts`), **1 migration générée**. Le module importe `ContactsModule`, `CatalogueModule` et `DatabaseModule` — aucun fichier des modules précédents n'est touché.

---

## Étape 1 — L'arrondi monétaire (dans `common/`)

En binaire, `0.1 + 0.2 !== 0.3`. Sur un devis, une dérive d'un centime entre le total affiché et la somme des lignes est inacceptable (et un client la verra TOUJOURS). Règle du projet : **arrondir au centime après chaque opération monétaire**, avec un helper unique.

### ➕ Créer `src/common/money/money.ts` (crée le dossier `money/`)

```typescript
/**
 * Arrondit un montant au centime (2 décimales).
 *
 * RÈGLE DU PROJET : toute opération monétaire (multiplication,
 * pourcentage, somme) passe par cet arrondi AVANT d'être stockée ou
 * additionnée à autre chose. En JavaScript, 0.1 + 0.2 vaut
 * 0.30000000000000004 : sans arrondi systématique, les totaux d'un
 * devis dérivent du détail de ses lignes.
 *
 * Number.EPSILON compense les représentations binaires limites
 * (1.005 * 100 = 100.49999... sans lui).
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 2 — Le domaine : statuts, lignes, devis, totaux

> Crée l'arborescence `src/modules/quotes/domain/`.

### ➕ Créer `src/modules/quotes/domain/quote-status.enum.ts`

```typescript
/**
 * Cycle de vie d'un devis. Transitions AUTORISÉES :
 *
 *   DRAFT ──send──▶ SENT ──accept──▶ ACCEPTED
 *                    │──reject──▶ REJECTED
 *                    └──(cron)──▶ EXPIRED
 *
 * Tout le reste est interdit : un devis accepté ne redevient jamais
 * brouillon, un brouillon ne peut pas être accepté sans avoir été
 * envoyé. Modification et suppression : DRAFT uniquement.
 */
export enum QuoteStatus {
  Draft = 'DRAFT',
  Sent = 'SENT',
  Accepted = 'ACCEPTED',
  Rejected = 'REJECTED',
  Expired = 'EXPIRED',
}
```

### ➕ Créer `src/modules/quotes/domain/quote-line.ts`

```typescript
/**
 * Ligne de devis.
 *
 * PRINCIPE DU FIGEMENT : la ligne COPIE description, prix unitaire et
 * TVA au moment de sa création. Si le produit du catalogue change de
 * prix ensuite, le devis ne bouge pas — un devis est un engagement
 * daté, pas une vue dynamique du catalogue. productId ne sert plus
 * qu'à la traçabilité (null = ligne libre, hors catalogue).
 */
export class QuoteLine {
  constructor(
    public readonly id: string,
    public readonly quoteId: string,
    /** null = ligne libre (article hors catalogue). */
    public readonly productId: string | null,
    public readonly description: string,
    /** Quantité (décimales autorisées : 2.5 heures). */
    public readonly quantity: number,
    /** Prix unitaire HT en EUR, figé à la création. */
    public readonly unitPrice: number,
    /** Taux de TVA en % (0, 5.5, 10, 20), figé à la création. */
    public readonly vatRate: number,
    /** Remise en % (0–100). */
    public readonly discountPercent: number,
    /** quantité × prix × (1 - remise/100), arrondi au centime. */
    public readonly subtotalHT: number,
  ) {}
}
```

### ➕ Créer `src/modules/quotes/domain/quote.ts`

```typescript
import { QuoteLine } from './quote-line';
import { QuoteStatus } from './quote-status.enum';

/**
 * Devis — agrégat racine : les lignes n'existent qu'à travers lui.
 *
 * Les totaux sont STOCKÉS (pas recalculés à la lecture) : ils sont
 * recalculés par le serveur à chaque écriture via computeQuoteTotals,
 * jamais fournis par le client.
 */
export class Quote {
  constructor(
    public readonly id: string,
    /** Numéro unique, séquentiel par année : DEV-2026-0001. */
    public readonly number: string,
    public readonly customerId: string,
    /**
     * Nom du client, dénormalisé pour l'affichage (jointure en
     * lecture) — jamais écrit dans la table quotes.
     */
    public readonly customerName: string,
    public readonly status: QuoteStatus,
    public readonly validUntil: Date,
    public readonly notes: string | null,
    public readonly totalHT: number,
    public readonly totalVAT: number,
    public readonly totalTTC: number,
    /** UUID de l'utilisateur créateur. */
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** Vide dans les listes ; complet dans le détail. */
    public readonly lines: QuoteLine[],
  ) {}

  /** Seul un brouillon est modifiable et supprimable. */
  isDraft(): boolean {
    return this.status === QuoteStatus.Draft;
  }

  /** Seul un devis envoyé peut être accepté, refusé ou expiré. */
  isSent(): boolean {
    return this.status === QuoteStatus.Sent;
  }
}
```

### ➕ Créer `src/modules/quotes/domain/quote-totals.ts`

Le calcul des totaux est de la **logique métier pure** : des fonctions sans dépendance, faciles à raisonner (et à tester au niveau complet).

```typescript
import { roundMoney } from '../../../common/money/money';

/** Ligne prête à calculer (contenu déjà résolu par le use case). */
export interface QuoteLineDraft {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPercent: number;
}

/** Ligne calculée : le sous-total HT est posé. */
export interface ComputedQuoteLine extends QuoteLineDraft {
  subtotalHT: number;
}

/** Totaux d'un devis. */
export interface QuoteTotals {
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

/** Sous-total HT d'une ligne : qté × prix × (1 - remise/100), au centime. */
export function computeLineSubtotal(line: QuoteLineDraft): number {
  return roundMoney(
    line.quantity * line.unitPrice * (1 - line.discountPercent / 100),
  );
}

/** Pose le sous-total de chaque ligne. */
export function computeLines(lines: QuoteLineDraft[]): ComputedQuoteLine[] {
  return lines.map((line) => ({
    ...line,
    subtotalHT: computeLineSubtotal(line),
  }));
}

/**
 * Totaux du devis à partir des lignes calculées.
 * La TVA est calculée ligne par ligne (chaque ligne a son taux) puis
 * sommée — et chaque étape est arrondie au centime.
 */
export function computeQuoteTotals(lines: ComputedQuoteLine[]): QuoteTotals {
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

## Étape 3 — Le port du repository

### ➕ Créer `src/modules/quotes/domain/quote-repository.port.ts`

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Quote } from './quote';
import { ComputedQuoteLine } from './quote-totals';
import { QuoteStatus } from './quote-status.enum';

/** Critères de listing des devis. */
export interface ListQuotesQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur le numéro et le nom du client. */
  search?: string;
  status?: QuoteStatus;
  customerId?: string;
  /** Bornes sur la date de création (incluses). */
  from?: Date;
  to?: Date;
}

/** Données de création (tout est déjà résolu et calculé). */
export interface CreateQuoteData {
  number: string;
  customerId: string;
  status: QuoteStatus;
  validUntil: Date;
  notes: string | null;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  createdBy: string;
  lines: ComputedQuoteLine[];
}

/**
 * Champs modifiables d'un devis (DRAFT uniquement, garanti par le use
 * case). Si `lines` est fourni : REMPLACEMENT COMPLET des lignes, avec
 * les totaux recalculés fournis ensemble.
 */
export interface UpdateQuoteData {
  customerId?: string;
  validUntil?: Date;
  notes?: string | null;
  totalHT?: number;
  totalVAT?: number;
  totalTTC?: number;
  lines?: ComputedQuoteLine[];
}

/** Contrat de persistance des devis. */
export interface QuoteRepositoryPort {
  /** Liste paginée (client joint, SANS les lignes). */
  findAll(query: ListQuotesQuery): Promise<PaginatedResult<Quote>>;

  /** Détail complet (lignes triées + client) ; null si inconnu. */
  findById(id: string): Promise<Quote | null>;

  /** Devis SENT dont validUntil est dépassée (pour la tâche cron). */
  findExpired(now: Date): Promise<Quote[]>;

  /** Prochain numéro de l'année courante (DEV-YYYY-NNNN). */
  nextNumber(): Promise<string>;

  /** Crée le devis ET ses lignes (atomique). */
  create(data: CreateQuoteData): Promise<Quote>;

  /** Modifie le devis, remplace les lignes si fournies (atomique). */
  update(id: string, data: UpdateQuoteData): Promise<Quote>;

  /** Change uniquement le statut (transitions et cron). */
  updateStatus(id: string, status: QuoteStatus): Promise<void>;

  /** Suppression PHYSIQUE (brouillons uniquement) ; les lignes suivent
   *  via ON DELETE CASCADE. */
  delete(id: string): Promise<void>;
}

/** Jeton d'injection du repository devis. */
export const QUOTE_REPOSITORY = Symbol('QUOTE_REPOSITORY');
```

> 📌 **Pourquoi une suppression physique ici, alors que tout le reste du projet est en soft-delete ?** Seuls les BROUILLONS sont supprimables : ils n'engagent personne et n'ont aucune valeur d'historique. Un devis envoyé, lui, ne se supprime jamais — il se refuse ou il expire, et il reste.

**✅ Point de contrôle** : `npm run build`

---

## Étape 4 — Les entités TypeORM et le mapper

> Crée l'arborescence `src/modules/quotes/infrastructure/entities/`.

### ➕ Créer `src/modules/quotes/infrastructure/entities/quote.entity.ts`

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { ContactEntity } from '../../../contacts/infrastructure/entities/contact.entity';
import { QuoteStatus } from '../../domain/quote-status.enum';
import { QuoteLineEntity } from './quote-line.entity';

/**
 * Entité TypeORM de la table `quotes`.
 *
 * cascade: ['insert'] sur lines : sauvegarder un devis avec ses lignes
 * les insère TOUTES dans la même opération (TypeORM ouvre lui-même une
 * transaction pour les save() en cascade).
 */
@Entity({ name: 'quotes' })
export class QuoteEntity extends AuditableEntity {
  /** Numéro unique, séquentiel par année (DEV-2026-0001). */
  @Index('UQ_quotes_number', { unique: true })
  @Column({ name: 'number', type: 'nvarchar', length: 20 })
  number!: string;

  @Index('IX_quotes_customer')
  @Column({ name: 'customer_id', type: 'uniqueidentifier' })
  customerId!: string;

  /** Relation : clé étrangère SQL + jointure du nom client en lecture. */
  @ManyToOne(() => ContactEntity)
  @JoinColumn({ name: 'customer_id' })
  customer?: ContactEntity;

  @Index('IX_quotes_status')
  @Column({ name: 'status', type: 'nvarchar', length: 10 })
  status!: QuoteStatus;

  @Column({ name: 'valid_until', type: 'datetime2' })
  validUntil!: Date;

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

  /** Les lignes vivent et meurent avec le devis. */
  @OneToMany(() => QuoteLineEntity, (line) => line.quote, {
    cascade: ['insert'],
  })
  lines?: QuoteLineEntity[];
}
```

> 💡 `AuditableEntity` fournit `createdBy` : on y stocke l'auteur du devis. La colonne `deleted_at` reste inutilisée (suppression physique des brouillons, cf. étape 3).

### ➕ Créer `src/modules/quotes/infrastructure/entities/quote-line.entity.ts`

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
import { QuoteEntity } from './quote.entity';

/**
 * Entité TypeORM de la table `quote_lines`.
 *
 * onDelete: 'CASCADE' : la suppression SQL d'un devis emporte ses
 * lignes — c'est la base qui garantit qu'aucune ligne orpheline ne
 * peut exister.
 */
@Entity({ name: 'quote_lines' })
export class QuoteLineEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Index('IX_quote_lines_quote')
  @Column({ name: 'quote_id', type: 'uniqueidentifier' })
  quoteId!: string;

  @ManyToOne(() => QuoteEntity, (quote) => quote.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quote_id' })
  quote?: QuoteEntity;

  /** null = ligne libre ; sinon trace du produit d'origine. */
  @Column({ name: 'product_id', type: 'uniqueidentifier', nullable: true })
  productId!: string | null;

  /** Relation déclarée pour la clé étrangère product_id -> products. */
  @ManyToOne(() => ProductEntity, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity | null;

  /** Ordre d'affichage des lignes sur le devis (0, 1, 2...). */
  @Column({ name: 'position', type: 'int' })
  position!: number;

  @Column({ name: 'description', type: 'nvarchar', length: 500 })
  description!: string;

  /** Quantité décimale (2.5 heures de main-d'œuvre). */
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
    name: 'discount_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: new DecimalColumnTransformer(),
  })
  discountPercent!: number;

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

### ➕ Créer `src/modules/quotes/infrastructure/quote.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Quote } from '../domain/quote';
import { QuoteLine } from '../domain/quote-line';
import { QuoteEntity } from './entities/quote.entity';
import { QuoteLineEntity } from './entities/quote-line.entity';

/** Conversion entités TypeORM -> modèles de domaine. */
@Injectable()
export class QuoteMapper {
  toDomain(entity: QuoteEntity): Quote {
    // Les lignes sont triées par position (ordre d'affichage du devis) ;
    // absentes (listes), le domaine porte un tableau vide.
    const lines = [...(entity.lines ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((line) => this.lineToDomain(line));

    return new Quote(
      entity.id,
      entity.number,
      entity.customerId,
      // Client joint en lecture ; chaîne vide si la relation n'a pas
      // été chargée (cas du cron, qui ne s'en sert pas).
      entity.customer?.companyName ?? '',
      entity.status,
      entity.validUntil,
      entity.notes,
      entity.totalHT,
      entity.totalVAT,
      entity.totalTTC,
      entity.createdBy,
      entity.createdAt,
      entity.updatedAt,
      lines,
    );
  }

  private lineToDomain(entity: QuoteLineEntity): QuoteLine {
    return new QuoteLine(
      entity.id,
      entity.quoteId,
      entity.productId,
      entity.description,
      entity.quantity,
      entity.unitPrice,
      entity.vatRate,
      entity.discountPercent,
      entity.subtotalHT,
    );
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 5 — La migration

```bash
npm run migration:generate -- src/database/migrations/CreateQuotesTables
```

**Relis le fichier généré**. Tu dois y trouver :

- `CREATE TABLE "quotes"` avec `UQ_quotes_number` (**unique**), les index `IX_quotes_customer` et `IX_quotes_status`, et les trois colonnes `decimal(12,2)` ;
- `CREATE TABLE "quote_lines"` avec `position`, les décimaux, et `product_id` nullable ;
- **trois `FOREIGN KEY`** : `quotes.customer_id → contacts`, `quote_lines.quote_id → quotes` avec **`ON DELETE CASCADE`** (c'est LA ligne importante), `quote_lines.product_id → products` ;
- un `down()` qui défait tout dans l'ordre inverse ;
- RIEN sur les tables existantes.

Puis :

```bash
npm run migration:run
npm run migration:show   # CreateQuotesTables cochée [X]
```

**✅ Point de contrôle** : la FK `quote_lines.quote_id` affiche « Delete Rule : CASCADE » dans ton client SQL.

---

## Étape 6 — Le repository

### ➕ Créer `src/modules/quotes/infrastructure/typeorm-quote.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { TransactionService } from '../../../database/transaction/transaction.service';
import { Quote } from '../domain/quote';
import {
  CreateQuoteData,
  ListQuotesQuery,
  QuoteRepositoryPort,
  UpdateQuoteData,
} from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';
import { QuoteEntity } from './entities/quote.entity';
import { QuoteLineEntity } from './entities/quote-line.entity';
import { QuoteMapper } from './quote.mapper';

/** Liste blanche de tri (colonnes du devis + client joint). */
const QUOTE_SORTABLE_COLUMNS: ColumnWhitelist = {
  number: 'quote.number',
  status: 'quote.status',
  validUntil: 'quote.validUntil',
  totalTTC: 'quote.totalTTC',
  customerName: 'customer.companyName',
  createdAt: 'quote.createdAt',
};

/** Recherche textuelle : numéro du devis et nom du client. */
const QUOTE_SEARCHABLE_COLUMNS = [
  'quote.number',
  'customer.companyName',
] as const;

/** Implémentation TypeORM du repository devis. */
@Injectable()
export class TypeOrmQuoteRepository implements QuoteRepositoryPort {
  constructor(
    @InjectRepository(QuoteEntity)
    private readonly repository: Repository<QuoteEntity>,
    private readonly transactionService: TransactionService,
    private readonly mapper: QuoteMapper,
  ) {}

  async findAll(query: ListQuotesQuery): Promise<PaginatedResult<Quote>> {
    // Client joint pour le nom ; PAS les lignes (inutiles en liste,
    // et une jointure OneToMany multiplierait les lignes de résultat).
    const queryBuilder = this.repository
      .createQueryBuilder('quote')
      .innerJoinAndSelect('quote.customer', 'customer');

    if (query.status !== undefined) {
      queryBuilder.andWhere('quote.status = :status', {
        status: query.status,
      });
    }
    if (query.customerId !== undefined) {
      queryBuilder.andWhere('quote.customerId = :customerId', {
        customerId: query.customerId,
      });
    }
    if (query.from !== undefined) {
      queryBuilder.andWhere('quote.createdAt >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('quote.createdAt <= :to', { to: query.to });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      QUOTE_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('quote.createdAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        QUOTE_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Quote | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { customer: true, lines: true },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findExpired(now: Date): Promise<Quote[]> {
    const entities = await this.repository.find({
      where: { status: QuoteStatus.Sent, validUntil: LessThan(now) },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DEV-${year}-`;

    // MAX du numéro de l'année : la séquence ne dépend pas d'un COUNT
    // (qui redescendrait après suppression d'un brouillon).
    const raw = await this.repository
      .createQueryBuilder('quote')
      .select('MAX(quote.number)', 'max')
      .where('quote.number LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    const lastSequence = raw?.max ? Number(raw.max.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
  }

  async create(data: CreateQuoteData): Promise<Quote> {
    const { lines, ...quoteColumns } = data;

    // cascade: ['insert'] : le devis ET ses lignes partent dans le même
    // save() — TypeORM ouvre une transaction pour l'ensemble.
    const entity = this.repository.create({
      ...quoteColumns,
      lines: lines.map((line, index) => ({ ...line, position: index })),
    });
    const saved = await this.repository.save(entity);

    // Relecture : renvoie l'état complet (client joint, lignes triées).
    return (await this.findById(saved.id)) as Quote;
  }

  async update(id: string, data: UpdateQuoteData): Promise<Quote> {
    const { lines, ...quoteColumns } = data;

    await this.transactionService.execute(async (manager) => {
      const changes: Partial<QuoteEntity> = {};
      for (const [key, value] of Object.entries(quoteColumns)) {
        if (value !== undefined) {
          (changes as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(changes).length > 0) {
        await manager.getRepository(QuoteEntity).update({ id }, changes);
      }

      // Remplacement COMPLET des lignes : plus simple et plus sûr que
      // de réconcilier ligne à ligne (le devis est encore un brouillon).
      if (lines !== undefined) {
        const lineRepository = manager.getRepository(QuoteLineEntity);
        await lineRepository.delete({ quoteId: id });
        await lineRepository.save(
          lines.map((line, index) =>
            lineRepository.create({ ...line, quoteId: id, position: index }),
          ),
        );
      }
    });

    return (await this.findById(id)) as Quote;
  }

  async updateStatus(id: string, status: QuoteStatus): Promise<void> {
    await this.repository.update({ id }, { status });
  }

  async delete(id: string): Promise<void> {
    // Suppression physique : les lignes suivent via ON DELETE CASCADE.
    await this.repository.delete({ id });
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 7 — Les cas d'utilisation (9)

> Crée le dossier `src/modules/quotes/application/`.

### ➕ Créer `src/modules/quotes/application/list-quotes.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type {
  ListQuotesQuery,
  QuoteRepositoryPort,
} from '../domain/quote-repository.port';

/** Cas d'utilisation : lister les devis (pagination + filtres). */
@Injectable()
export class ListQuotesUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
  ) {}

  execute(query: ListQuotesQuery): Promise<PaginatedResult<Quote>> {
    return this.quoteRepository.findAll(query);
  }
}
```

### ➕ Créer `src/modules/quotes/application/get-quote-by-id.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';

/** Cas d'utilisation : récupérer un devis complet (404 si inconnu). */
@Injectable()
export class GetQuoteByIdUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
  ) {}

  async execute(quoteId: string): Promise<Quote> {
    const quote = await this.quoteRepository.findById(quoteId);
    if (!quote) {
      throw new ResourceNotFoundException('Le devis');
    }
    return quote;
  }
}
```

### ➕ Créer `src/modules/quotes/application/resolve-quote-lines.helper.ts`

La résolution des lignes (produit du catalogue OU ligne libre) sert à la création ET à la modification : on la factorise dans un service applicatif dédié plutôt que de la dupliquer.

```typescript
import { Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { computeLines } from '../domain/quote-totals';
import type {
  ComputedQuoteLine,
  QuoteLineDraft,
} from '../domain/quote-totals';

/** Ligne telle que reçue de l'API (avant résolution). */
export interface QuoteLineInput {
  productId?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  vatRate?: number;
  discountPercent?: number;
}

/**
 * Résout chaque ligne d'un devis :
 *   - ligne PRODUIT (productId fourni) : le produit doit exister (404)
 *     et être actif (409) ; description, prix et TVA sont COPIÉS du
 *     produit si non fournis — puis figés dans la ligne ;
 *   - ligne LIBRE (pas de productId) : description et prix obligatoires.
 * Renvoie les lignes avec leur sous-total HT calculé.
 */
@Injectable()
export class ResolveQuoteLinesHelper {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
  ) {}

  async resolve(inputs: QuoteLineInput[]): Promise<ComputedQuoteLine[]> {
    const drafts: QuoteLineDraft[] = [];

    for (const input of inputs) {
      if (input.productId !== undefined) {
        const product = await this.getProductByIdUseCase.execute(
          input.productId,
        );
        if (!product.isActive) {
          throw new BusinessRuleViolationException(
            `Le produit « ${product.name} » est désactivé : il ne peut ` +
              'plus être ajouté à un devis.',
          );
        }
        drafts.push({
          productId: product.id,
          description: input.description ?? product.name,
          quantity: input.quantity,
          unitPrice: input.unitPrice ?? product.unitPrice,
          vatRate: input.vatRate ?? product.vatRate,
          discountPercent: input.discountPercent ?? 0,
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
          discountPercent: input.discountPercent ?? 0,
        });
      }
    }

    return computeLines(drafts);
  }
}
```

### ➕ Créer `src/modules/quotes/application/create-quote.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetContactByIdUseCase } from '../../contacts/application/get-contact-by-id.use-case';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';
import { computeQuoteTotals } from '../domain/quote-totals';
import { QuoteLineInput, ResolveQuoteLinesHelper } from './resolve-quote-lines.helper';

/** Durée de validité par défaut d'un devis (jours). */
const DEFAULT_VALIDITY_DAYS = 30;

/** Données de création (déjà validées par le DTO). */
export interface CreateQuoteInput {
  customerId: string;
  validUntil?: string;
  notes?: string;
  lines: QuoteLineInput[];
}

/**
 * Cas d'utilisation : créer un devis (statut DRAFT).
 *
 * Règles :
 *   - le contact doit être un CLIENT (CUSTOMER ou BOTH) ;
 *   - lignes résolues (produit actif copié / ligne libre complète) ;
 *   - totaux calculés CÔTÉ SERVEUR — jamais confiés au client ;
 *   - numéro généré (DEV-YYYY-NNNN), validité par défaut : +30 jours.
 */
@Injectable()
export class CreateQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveQuoteLinesHelper: ResolveQuoteLinesHelper,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateQuoteInput,
  ): Promise<Quote> {
    const contact = await this.getContactByIdUseCase.execute(input.customerId);
    if (!contact.isCustomer()) {
      throw new BusinessRuleViolationException(
        `Le contact « ${contact.companyName} » n'est pas un client ` +
          '(type CUSTOMER ou BOTH requis).',
      );
    }

    const lines = await this.resolveQuoteLinesHelper.resolve(input.lines);
    const totals = computeQuoteTotals(lines);

    const validUntil = input.validUntil
      ? new Date(input.validUntil)
      : new Date(Date.now() + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    return this.quoteRepository.create({
      number: await this.quoteRepository.nextNumber(),
      customerId: input.customerId,
      status: QuoteStatus.Draft,
      validUntil,
      notes: input.notes ?? null,
      ...totals,
      createdBy: actor.userId,
      lines,
    });
  }
}
```

### ➕ Créer `src/modules/quotes/application/update-quote.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetContactByIdUseCase } from '../../contacts/application/get-contact-by-id.use-case';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type {
  QuoteRepositoryPort,
  UpdateQuoteData,
} from '../domain/quote-repository.port';
import { computeQuoteTotals } from '../domain/quote-totals';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';
import { QuoteLineInput, ResolveQuoteLinesHelper } from './resolve-quote-lines.helper';

/** Champs modifiables (sémantique PATCH ; lines = remplacement complet). */
export interface UpdateQuoteInput {
  customerId?: string;
  validUntil?: string;
  notes?: string;
  lines?: QuoteLineInput[];
}

/**
 * Cas d'utilisation : modifier un devis — BROUILLON UNIQUEMENT.
 * Si les lignes sont fournies, elles REMPLACENT toutes les anciennes
 * et les totaux sont recalculés.
 */
@Injectable()
export class UpdateQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveQuoteLinesHelper: ResolveQuoteLinesHelper,
  ) {}

  async execute(quoteId: string, input: UpdateQuoteInput): Promise<Quote> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);
    if (!quote.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seul un devis en brouillon est modifiable (statut actuel : ` +
          `${quote.status}).`,
      );
    }

    const changes: UpdateQuoteData = {};

    if (input.customerId !== undefined) {
      const contact = await this.getContactByIdUseCase.execute(
        input.customerId,
      );
      if (!contact.isCustomer()) {
        throw new BusinessRuleViolationException(
          `Le contact « ${contact.companyName} » n'est pas un client ` +
            '(type CUSTOMER ou BOTH requis).',
        );
      }
      changes.customerId = input.customerId;
    }

    if (input.validUntil !== undefined) {
      changes.validUntil = new Date(input.validUntil);
    }
    if (input.notes !== undefined) {
      changes.notes = input.notes;
    }

    if (input.lines !== undefined) {
      const lines = await this.resolveQuoteLinesHelper.resolve(input.lines);
      const totals = computeQuoteTotals(lines);
      changes.lines = lines;
      changes.totalHT = totals.totalHT;
      changes.totalVAT = totals.totalVAT;
      changes.totalTTC = totals.totalTTC;
    }

    return this.quoteRepository.update(quoteId, changes);
  }
}
```

### ➕ Créer `src/modules/quotes/application/delete-quote.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';

/**
 * Cas d'utilisation : supprimer un devis — BROUILLON UNIQUEMENT.
 * Suppression physique : un brouillon n'engage personne. Un devis
 * envoyé, lui, ne se supprime JAMAIS (il se refuse ou expire).
 */
@Injectable()
export class DeleteQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
  ) {}

  async execute(quoteId: string): Promise<void> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);
    if (!quote.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seul un devis en brouillon peut être supprimé (statut actuel : ` +
          `${quote.status}).`,
      );
    }

    await this.quoteRepository.delete(quoteId);
  }
}
```

### ➕ Créer `src/modules/quotes/application/send-quote.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';

/**
 * Cas d'utilisation : envoyer un devis (DRAFT -> SENT).
 *
 * Version minimale : uniquement la transition de statut. La génération
 * du PDF et l'e-mail au client (avec pièce jointe) sont branchés au
 * niveau min- — la transition, elle, ne changera pas.
 */
@Injectable()
export class SendQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
  ) {}

  async execute(quoteId: string): Promise<Quote> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);
    if (!quote.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seul un devis en brouillon peut être envoyé (statut actuel : ` +
          `${quote.status}).`,
      );
    }

    await this.quoteRepository.updateStatus(quoteId, QuoteStatus.Sent);
    return this.getQuoteByIdUseCase.execute(quoteId);
  }
}
```

### ➕ Créer `src/modules/quotes/application/accept-quote.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';

/**
 * Cas d'utilisation : accepter un devis (SENT -> ACCEPTED).
 * La conversion en commande arrivera avec le module 06.
 */
@Injectable()
export class AcceptQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
  ) {}

  async execute(quoteId: string): Promise<Quote> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);
    if (!quote.isSent()) {
      throw new BusinessRuleViolationException(
        `Seul un devis envoyé peut être accepté (statut actuel : ` +
          `${quote.status}).`,
      );
    }

    await this.quoteRepository.updateStatus(quoteId, QuoteStatus.Accepted);
    return this.getQuoteByIdUseCase.execute(quoteId);
  }
}
```

### ➕ Créer `src/modules/quotes/application/reject-quote.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';

/** Cas d'utilisation : refuser un devis (SENT -> REJECTED). */
@Injectable()
export class RejectQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
  ) {}

  async execute(quoteId: string): Promise<Quote> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);
    if (!quote.isSent()) {
      throw new BusinessRuleViolationException(
        `Seul un devis envoyé peut être refusé (statut actuel : ` +
          `${quote.status}).`,
      );
    }

    await this.quoteRepository.updateStatus(quoteId, QuoteStatus.Rejected);
    return this.getQuoteByIdUseCase.execute(quoteId);
  }
}
```

### ➕ Créer `src/modules/quotes/application/expire-quotes.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';

/**
 * Cas d'utilisation : faire expirer les devis dépassés.
 * Appelé par la tâche planifiée (étape 8) : tous les devis SENT dont
 * validUntil est passée basculent en EXPIRED. Idempotent : zéro devis
 * à expirer est un résultat normal.
 */
@Injectable()
export class ExpireQuotesUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
  ) {}

  /** Renvoie le nombre de devis expirés. */
  async execute(): Promise<number> {
    const expired = await this.quoteRepository.findExpired(new Date());

    for (const quote of expired) {
      await this.quoteRepository.updateStatus(quote.id, QuoteStatus.Expired);
    }

    return expired.length;
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 8 — La tâche planifiée

Le socle enregistre déjà `ScheduleModule.forRoot()` (dans `SchedulerModule`) : un décorateur `@Cron` fonctionne donc dans N'IMPORTE quel module. On reproduit le pattern de la purge de sessions : interrupteur `SCHEDULER_ENABLED`, verrou anti-chevauchement, journalisation, erreurs capturées.

### ➕ Créer `src/modules/quotes/application/expire-quotes.task.ts`

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { observabilityConfig } from '../../../config/observability.config';
import { ExpireQuotesUseCase } from './expire-quotes.use-case';

/**
 * Tâche planifiée : expiration des devis dépassés.
 *
 * - exécution quotidienne à 01:00 ;
 * - désactivable via SCHEDULER_ENABLED=false (comme toutes les tâches) ;
 * - verrou local anti-chevauchement (mono-instance, cf. socle) ;
 * - un échec est journalisé, jamais propagé : le cron ne doit pas
 *   faire tomber le processus.
 *
 * execute() est publique : appelable directement (tests, rattrapage
 * manuel) sans attendre 01:00.
 */
@Injectable()
export class ExpireQuotesTask {
  private readonly logger = new Logger(ExpireQuotesTask.name);
  private running = false;

  constructor(
    private readonly expireQuotesUseCase: ExpireQuotesUseCase,
    @Inject(observabilityConfig.KEY)
    private readonly config: ConfigType<typeof observabilityConfig>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron(): Promise<void> {
    if (!this.config.schedulerEnabled) {
      return;
    }
    await this.execute();
  }

  /** Fait expirer les devis dépassés ; renvoie le nombre traité. */
  async execute(): Promise<number> {
    if (this.running) {
      this.logger.warn(
        'Expiration des devis ignorée : une exécution est déjà en cours.',
      );
      return 0;
    }

    this.running = true;
    const startedAt = Date.now();

    try {
      const count = await this.expireQuotesUseCase.execute();
      this.logger.log(
        `Expiration des devis : terminée en ${Date.now() - startedAt} ms, ` +
          `${count} devis expiré(s).`,
      );
      return count;
    } catch (error) {
      this.logger.error(
        `Expiration des devis : échec — ` +
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

## Étape 9 — Les DTOs

> Crée le dossier `src/modules/quotes/presentation/dto/`.

### ➕ Créer `src/modules/quotes/presentation/dto/quote-line-input.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Une ligne du corps de création/modification d'un devis.
 *
 * Deux usages :
 *   - ligne PRODUIT : productId fourni — description, unitPrice et
 *     vatRate sont optionnels (copiés du produit si absents) ;
 *   - ligne LIBRE : pas de productId — description et unitPrice
 *     deviennent obligatoires (vérifié par le use case).
 */
export class QuoteLineInputDto {
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
    example: 'Écran Dell 27" QHD',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La description ne peut pas être vide.' })
  @MaxLength(500, {
    message: 'La description ne peut pas dépasser 500 caractères.',
  })
  description?: string;

  @ApiProperty({
    description: 'Quantité (décimales autorisées : 2.5 heures).',
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
    example: 349.9,
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

  @ApiPropertyOptional({
    description: 'Remise en % (0–100, défaut 0).',
    example: 10,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La remise doit être un nombre (2 décimales max).' },
  )
  @Min(0, { message: 'La remise ne peut pas être négative.' })
  @Max(100, { message: 'La remise ne peut pas dépasser 100 %.' })
  discountPercent?: number;
}
```

### ➕ Créer `src/modules/quotes/presentation/dto/create-quote.dto.ts`

**La nouveauté** : un tableau de DTOs imbriqués. Sans `@ValidateNested` + `@Type`, le ValidationPipe validerait le tableau… mais PAS le contenu de chaque ligne.

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
import { QuoteLineInputDto } from './quote-line-input.dto';

/** Corps de POST /quotes. */
export class CreateQuoteDto {
  @ApiProperty({ description: 'Contact client (type CUSTOMER ou BOTH).' })
  @IsUUID(undefined, {
    message: 'Le customerId doit être un UUID valide.',
  })
  customerId!: string;

  @ApiPropertyOptional({
    description: 'Date limite de validité (ISO 8601). Défaut : +30 jours.',
    example: '2026-08-15',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Le champ "validUntil" doit être une date ISO.' },
  )
  validUntil?: string;

  @ApiPropertyOptional({ example: 'Remise fidélité appliquée sur les écrans.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;

  @ApiProperty({
    description: 'Lignes du devis (au moins une).',
    type: [QuoteLineInputDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Un devis doit contenir au moins une ligne.' })
  // ValidateNested : descend valider CHAQUE ligne ; Type : indique à
  // class-transformer la classe cible (sinon il reçoit des objets nus
  // et aucune validation de ligne ne s'exécute).
  @ValidateNested({ each: true })
  @Type(() => QuoteLineInputDto)
  lines!: QuoteLineInputDto[];
}
```

### ➕ Créer `src/modules/quotes/presentation/dto/update-quote.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateQuoteDto } from './create-quote.dto';

/**
 * Corps de PATCH /quotes/:id (brouillons uniquement).
 * Tout est optionnel ; si `lines` est fourni, les lignes existantes
 * sont INTÉGRALEMENT remplacées et les totaux recalculés.
 */
export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}
```

### ➕ Créer `src/modules/quotes/presentation/dto/list-quotes-query.dto.ts`

```typescript
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { QuoteStatus } from '../../domain/quote-status.enum';

/**
 * Query string de GET /quotes.
 * IntersectionType combine la pagination du socle ET la plage de dates
 * (from/to sur la date de CRÉATION du devis) — même pattern qu'au
 * module 04 pour l'historique des mouvements.
 */
export class ListQuotesQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus, {
    message:
      'Le statut doit valoir DRAFT, SENT, ACCEPTED, REJECTED ou EXPIRED.',
  })
  status?: QuoteStatus;

  @ApiPropertyOptional({ description: 'Filtre par client.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "customerId" doit être un UUID valide.',
  })
  customerId?: string;
}
```

### ➕ Créer `src/modules/quotes/presentation/dto/quote-line-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { QuoteLine } from '../../domain/quote-line';

/** Représentation publique d'une ligne de devis. */
export class QuoteLineResponseDto {
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

  @ApiProperty({ example: 10 })
  discountPercent!: number;

  @ApiProperty({ description: 'qté × prix × (1 - remise/100).', example: 629.82 })
  subtotalHT!: number;

  static fromDomain(line: QuoteLine): QuoteLineResponseDto {
    const dto = new QuoteLineResponseDto();
    dto.id = line.id;
    dto.productId = line.productId;
    dto.description = line.description;
    dto.quantity = line.quantity;
    dto.unitPrice = line.unitPrice;
    dto.vatRate = line.vatRate;
    dto.discountPercent = line.discountPercent;
    dto.subtotalHT = line.subtotalHT;
    return dto;
  }
}
```

### ➕ Créer `src/modules/quotes/presentation/dto/quote-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Quote } from '../../domain/quote';
import { QuoteStatus } from '../../domain/quote-status.enum';
import { QuoteLineResponseDto } from './quote-line-response.dto';

/**
 * Représentation publique d'un devis.
 * Dans les listes, `lines` est un tableau vide (le détail les charge).
 */
export class QuoteResponseDto {
  @ApiProperty({ description: 'Identifiant du devis (UUID).' })
  id!: string;

  @ApiProperty({ example: 'DEV-2026-0001' })
  number!: string;

  @ApiProperty({ enum: QuoteStatus })
  status!: QuoteStatus;

  @ApiProperty()
  customerId!: string;

  @ApiProperty({ example: 'ACME Industries' })
  customerName!: string;

  @ApiProperty({ description: 'Date limite de validité.' })
  validUntil!: Date;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: [QuoteLineResponseDto] })
  lines!: QuoteLineResponseDto[];

  @ApiProperty({ example: 714.82 })
  totalHT!: number;

  @ApiProperty({ example: 142.96 })
  totalVAT!: number;

  @ApiProperty({ example: 857.78 })
  totalTTC!: number;

  @ApiProperty({ nullable: true, description: 'UUID du créateur.' })
  createdBy!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(quote: Quote): QuoteResponseDto {
    const dto = new QuoteResponseDto();
    dto.id = quote.id;
    dto.number = quote.number;
    dto.status = quote.status;
    dto.customerId = quote.customerId;
    dto.customerName = quote.customerName;
    dto.validUntil = quote.validUntil;
    dto.notes = quote.notes;
    dto.lines = quote.lines.map(QuoteLineResponseDto.fromDomain);
    dto.totalHT = quote.totalHT;
    dto.totalVAT = quote.totalVAT;
    dto.totalTTC = quote.totalTTC;
    dto.createdBy = quote.createdBy;
    dto.createdAt = quote.createdAt;
    dto.updatedAt = quote.updatedAt;
    return dto;
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 10 — Le contrôleur

### ➕ Créer `src/modules/quotes/presentation/quotes.controller.ts`

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
import { AcceptQuoteUseCase } from '../application/accept-quote.use-case';
import { CreateQuoteUseCase } from '../application/create-quote.use-case';
import { DeleteQuoteUseCase } from '../application/delete-quote.use-case';
import { GetQuoteByIdUseCase } from '../application/get-quote-by-id.use-case';
import { ListQuotesUseCase } from '../application/list-quotes.use-case';
import { RejectQuoteUseCase } from '../application/reject-quote.use-case';
import { SendQuoteUseCase } from '../application/send-quote.use-case';
import { UpdateQuoteUseCase } from '../application/update-quote.use-case';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ListQuotesQueryDto } from './dto/list-quotes-query.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

/**
 * Contrôleur des devis.
 * Création ouverte à tous les rôles (un employé prépare un devis) ;
 * modification et transitions ADMIN/MANAGER ; suppression ADMIN.
 */
@ApiTags('Devis')
@ApiBearerAuth()
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly listQuotesUseCase: ListQuotesUseCase,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
    private readonly createQuoteUseCase: CreateQuoteUseCase,
    private readonly updateQuoteUseCase: UpdateQuoteUseCase,
    private readonly deleteQuoteUseCase: DeleteQuoteUseCase,
    private readonly sendQuoteUseCase: SendQuoteUseCase,
    private readonly acceptQuoteUseCase: AcceptQuoteUseCase,
    private readonly rejectQuoteUseCase: RejectQuoteUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des devis',
    description:
      'Filtres : status, customerId, from/to (date de création, ISO), ' +
      'search (numéro / nom du client). Les lignes ne sont pas incluses.',
  })
  @ApiOkResponse({ type: [QuoteResponseDto] })
  async list(
    @Query() query: ListQuotesQueryDto,
  ): Promise<PaginatedResult<QuoteResponseDto>> {
    const result = await this.listQuotesUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      status: query.status,
      customerId: query.customerId,
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(QuoteResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un devis (avec ses lignes)" })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Devis inconnu.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.getQuoteByIdUseCase.execute(id);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Post()
  @ApiOperation({
    summary: 'Créer un devis (statut DRAFT)',
    description:
      'Numéro auto (DEV-YYYY-NNNN), totaux calculés côté serveur, ' +
      'validité par défaut +30 jours.',
  })
  @ApiCreatedResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Client ou produit inconnu.' })
  @ApiConflictResponse({
    description:
      'Contact non client, produit désactivé ou ligne libre incomplète.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateQuoteDto,
  ): Promise<QuoteResponseDto> {
    const quote = await this.createQuoteUseCase.execute(user, body);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Modifier un devis (DRAFT uniquement)',
    description:
      'Si `lines` est fourni : remplacement complet des lignes et ' +
      'recalcul des totaux.',
  })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Devis inconnu.' })
  @ApiConflictResponse({
    description: 'Devis non modifiable (statut ≠ DRAFT).',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateQuoteDto,
  ): Promise<QuoteResponseDto> {
    const quote = await this.updateQuoteUseCase.execute(id, body);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un devis (DRAFT uniquement)',
    description: 'Suppression physique : un brouillon n’engage personne.',
  })
  @ApiNoContentResponse({ description: 'Devis supprimé.' })
  @ApiConflictResponse({
    description: 'Devis non supprimable (statut ≠ DRAFT).',
  })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteQuoteUseCase.execute(id);
  }

  @Post(':id/send')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoyer un devis (DRAFT → SENT)',
    description:
      'Version minimale : transition de statut seule. PDF et e-mail au ' +
      'client arrivent au niveau min-.',
  })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async send(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.sendQuoteUseCase.execute(id);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Post(':id/accept')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accepter un devis (SENT → ACCEPTED)' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async accept(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.acceptQuoteUseCase.execute(id);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Post(':id/reject')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refuser un devis (SENT → REJECTED)' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.rejectQuoteUseCase.execute(id);
    return QuoteResponseDto.fromDomain(quote);
  }
}
```

**À retenir :**
- **`@HttpCode(HttpStatus.OK)` sur send/accept/reject** : un `@Post()` NestJS renvoie 201 par défaut — or ces routes ne CRÉENT rien, elles changent un état. 200 est le bon code.
- Les transitions renvoient le devis complet mis à jour : le front peut rafraîchir son affichage sans second appel.

**✅ Point de contrôle** : `npm run build`

---

## Étape 11 — Le module + AppModule

### ➕ Créer `src/modules/quotes/quotes.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { ContactsModule } from '../contacts/contacts.module';
import { AcceptQuoteUseCase } from './application/accept-quote.use-case';
import { CreateQuoteUseCase } from './application/create-quote.use-case';
import { DeleteQuoteUseCase } from './application/delete-quote.use-case';
import { ExpireQuotesTask } from './application/expire-quotes.task';
import { ExpireQuotesUseCase } from './application/expire-quotes.use-case';
import { GetQuoteByIdUseCase } from './application/get-quote-by-id.use-case';
import { ListQuotesUseCase } from './application/list-quotes.use-case';
import { RejectQuoteUseCase } from './application/reject-quote.use-case';
import { ResolveQuoteLinesHelper } from './application/resolve-quote-lines.helper';
import { SendQuoteUseCase } from './application/send-quote.use-case';
import { UpdateQuoteUseCase } from './application/update-quote.use-case';
import { QUOTE_REPOSITORY } from './domain/quote-repository.port';
import { QuoteEntity } from './infrastructure/entities/quote.entity';
import { QuoteLineEntity } from './infrastructure/entities/quote-line.entity';
import { QuoteMapper } from './infrastructure/quote.mapper';
import { TypeOrmQuoteRepository } from './infrastructure/typeorm-quote.repository';
import { QuotesController } from './presentation/quotes.controller';

/**
 * Module des devis.
 *
 * Imports :
 *   - ContactsModule : GetContactByIdUseCase (validation du client) ;
 *   - CatalogueModule : GetProductByIdUseCase (résolution des lignes) ;
 *   - DatabaseModule : TransactionService (remplacement des lignes).
 *
 * QUOTE_REPOSITORY et GetQuoteByIdUseCase sont exportés : le module
 * commandes (06) en aura besoin pour convertir un devis accepté.
 *
 * La tâche cron ExpireQuotesTask vit ici (le @Cron fonctionne car
 * ScheduleModule.forRoot() est déjà enregistré par SchedulerModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([QuoteEntity, QuoteLineEntity]),
    ContactsModule,
    CatalogueModule,
    DatabaseModule,
  ],
  controllers: [QuotesController],
  providers: [
    QuoteMapper,
    ResolveQuoteLinesHelper,
    ListQuotesUseCase,
    GetQuoteByIdUseCase,
    CreateQuoteUseCase,
    UpdateQuoteUseCase,
    DeleteQuoteUseCase,
    SendQuoteUseCase,
    AcceptQuoteUseCase,
    RejectQuoteUseCase,
    ExpireQuotesUseCase,
    ExpireQuotesTask,
    {
      provide: QUOTE_REPOSITORY,
      useClass: TypeOrmQuoteRepository,
    },
  ],
  exports: [QUOTE_REPOSITORY, GetQuoteByIdUseCase],
})
export class QuotesModule {}
```

### ✏️ Modifier `src/app.module.ts`

**1)** Ajoute l'import :

```typescript
import { QuotesModule } from './modules/quotes/quotes.module';
```

**2)** Dans le tableau `imports`, ajoute `QuotesModule` après `StockModule` (ou après `CatalogueModule` si tu n'as pas fait le module 04) :

```typescript
    CatalogueModule,
    StockModule,
    QuotesModule,
    AuthenticationModule,
```

**✅ Point de contrôle** :

```bash
npm run build
npm run start:dev
```

Les logs listent les 8 routes `/api/v1/quotes*` ; Swagger affiche la section « Devis ».

---

## Étape 12 — Vérifier que ça marche & ce qu'on verra plus tard

### 12.1 Parcours manuel (PowerShell)

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion en ADMIN
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

# 2. Un client et un produit (modules 02 et 03)
$client = Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"type":"CUSTOMER","companyName":"ACME Industries","email":"contact@acme.fr"}'
$prod = Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Écran Dell 27\" QHD","type":"PRODUCT","unit":"UNIT","unitPrice":349.90}'

# 3. Créer un devis : 1 ligne produit (prix copiés) + 1 ligne libre
$quote = Invoke-RestMethod -Method Post -Uri "$base/quotes" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"customerId":"' + $client.data.id + '","notes":"Remise fidélité.",' +
         '"lines":[' +
         '{"productId":"' + $prod.data.id + '","quantity":2,"discountPercent":10},' +
         '{"description":"Installation et câblage","quantity":2.5,"unitPrice":85}' +
         ']}')
$quote.data.number     # → DEV-2026-0001
$quote.data.totalHT    # → 842.32  (2×349.90×0.9 = 629.82 + 2.5×85 = 212.50)
$quote.data.totalTTC   # → 1010.78 (TVA 20% ligne par ligne)

# 4. Le devis est un engagement figé : change le prix du produit...
Invoke-RestMethod -Method Patch -Uri "$base/products/$($prod.data.id)" `
  -Headers $headers -ContentType 'application/json' -Body '{"unitPrice":999}' | Out-Null
# ... et vérifie que le devis n'a PAS bougé
(Invoke-RestMethod -Uri "$base/quotes/$($quote.data.id)" -Headers $headers).data.totalHT
# → toujours 842.32

# 5. Modifier le brouillon : remplacer les lignes (totaux recalculés)
Invoke-RestMethod -Method Patch -Uri "$base/quotes/$($quote.data.id)" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"lines":[{"productId":"' + $prod.data.id + '","quantity":1}]}') |
  ConvertTo-Json -Depth 5   # → nouveau prix catalogue (999) copié cette fois

# 6. Envoyer (DRAFT → SENT)
Invoke-RestMethod -Method Post -Uri "$base/quotes/$($quote.data.id)/send" `
  -Headers $headers | Out-Null

# 7. Le verrou : modifier un devis envoyé → 409
try {
  Invoke-RestMethod -Method Patch -Uri "$base/quotes/$($quote.data.id)" `
    -Headers $headers -ContentType 'application/json' -Body '{"notes":"trop tard"}'
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 8. La machine à états : accepter un devis... déjà accepté → 409
Invoke-RestMethod -Method Post -Uri "$base/quotes/$($quote.data.id)/accept" `
  -Headers $headers | Out-Null
try {
  Invoke-RestMethod -Method Post -Uri "$base/quotes/$($quote.data.id)/accept" `
    -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : Conflict (409)
}

# 9. Lister par statut
Invoke-RestMethod -Uri "$base/quotes?status=ACCEPTED" -Headers $headers |
  ConvertTo-Json -Depth 5

# 10. La numérotation : un 2e devis prend le numéro suivant
$quote2 = Invoke-RestMethod -Method Post -Uri "$base/quotes" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"customerId":"' + $client.data.id + '",' +
         '"lines":[{"description":"Audit réseau","quantity":1,"unitPrice":450}]}')
$quote2.data.number   # → DEV-2026-0002

# 11. Supprimer le brouillon (204) — un brouillon n'engage personne
Invoke-WebRequest -Method Delete -Uri "$base/quotes/$($quote2.data.id)" `
  -Headers $headers | Select-Object StatusCode
```

Même parcours possible à la souris dans **Swagger**.

### 12.2 Les pièges croisés en route (mémo)

| Piège | Parade |
|---|---|
| `0.1 + 0.2 = 0.30000000000000004` sur une facture | `roundMoney()` après CHAQUE opération monétaire |
| Le tableau de lignes validé… mais pas son contenu | `@ValidateNested({ each: true })` + `@Type(() => QuoteLineInputDto)` |
| Le prix catalogue change → les devis passés bougent | Figement : la ligne COPIE prix/description/TVA à la création |
| Jointure des lignes en liste = lignes de résultat multipliées | Les listes joignent le client, PAS les lignes (le détail si) |
| `COUNT` pour la numérotation redescend après suppression | `MAX(number)` de l'année courante |
| POST de transition qui renvoie 201 | `@HttpCode(HttpStatus.OK)` : rien n'est créé |
| Suppression du devis qui laisse des lignes orphelines | `ON DELETE CASCADE` sur la FK `quote_lines.quote_id` |
| Le cron tourne pendant les tests / la CI | Interrupteur `SCHEDULER_ENABLED` du socle (déjà en place) |

### 12.3 Ce qu'on verra plus tard (rien n'est perdu)

| Différé | Pourquoi ce n'est pas bloquant | Niveau |
|---|---|---|
| **PDF du devis** (`GET /quotes/:id/pdf`, template) | Le devis existe, est consultable et juste ; le PDF est la mise en forme | 🟡 min- |
| **E-mail au client** à l'envoi (PDF en pièce jointe) | La transition SENT est en place ; le mail s'y branchera sans la changer | 🟡 min- |
| **Conversion en commande** (`POST /quotes/:id/convert`) | Impossible avant le module 06 (les commandes n'existent pas encore) | ✅ couverte par `mini-DEV-06`, étape 11 |
| **Client complet embarqué** (`customer: ContactResponseDto`) | `customerName` + `customerId` couvrent l'affichage courant | 🟡 min- |
| **Audit** (`quotes.*`) | `createdBy` trace déjà l'auteur ; le journal central est un plus | 🟡 min- |
| **Tests** (unit : totaux avec remise, transitions ; e2e : cycle complet) | L'application fonctionne ; garantie long terme | 🔴 complet |

### 12.4 Ce que ce module t'a appris de nouveau

1. **L'agrégat** : le devis et ses lignes forment UN tout — cascade d'insertion, remplacement atomique (TransactionService), `ON DELETE CASCADE`.
2. **La machine à états** : un cycle de vie strict, défendu par des use cases qui refusent toute transition invalide avec un message qui dit l'état actuel.
3. **L'argent en JavaScript** : `roundMoney` après chaque opération — le module 07 (factures) reprendra exactement ces fonctions de calcul.
4. **Le figement** : un document commercial copie les données au moment T ; il ne « suit » pas le catalogue.
5. **`@ValidateNested` + `@Type`** : la validation en profondeur des DTOs imbriqués — indispensable pour tous les documents à lignes (commandes, factures).
6. **La tâche planifiée** : le pattern cron du socle (interrupteur, verrou, journalisation) appliqué à une règle métier.

---

*Fin du guide mini-DEV-05. Prochain module : les commandes (06) — conversion du devis accepté, statuts de livraison, et décrémentation du stock (le StockWriter du module 04 va resservir).*
