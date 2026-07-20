# mini-DEV-09 · Tableau de Bord — l'essentiel pour démarrer

> **Spec couverte** : `specs/09-tableau-de-bord/09-tableau-de-bord.md` (version minimale)
> **Niveau** : 🟢 fonctionnel — même logique que les `mini-DEV-01` à `08` (voir `RECAP-DEV-01` pour la philosophie des 3 niveaux).
> **Prérequis** : `mini-DEV-01` à `mini-DEV-08` terminés — le tableau de bord LIT les tables de tous les modules métier (devis, commandes, factures, stock). Sans le 08, il fonctionne aussi… mais le chiffre d'affaires restera à 0 (aucune facture ne passe `PAID` sans paiements).
> **Promesse** : à la fin, UN écran qui répond aux questions du matin — combien a-t-on facturé ce mois-ci ? qui nous doit de l'argent ? qu'y a-t-il dans le pipe commercial ? quoi livrer, quoi réapprovisionner ? — calculé à la volée par 8 requêtes SQL agrégées lancées EN PARALLÈLE. Aucune entité, aucune table, aucune migration : le module le plus léger du projet, et le premier 100 % lecture. 1 route dans Swagger. Environ 1 h 30.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — Le domaine : les interfaces des métriques](#étape-1--le-domaine--les-interfaces-des-métriques)
- [Étape 2 — Le service de requêtes SQL](#étape-2--le-service-de-requêtes-sql)
- [Étape 3 — Le cas d'utilisation](#étape-3--le-cas-dutilisation)
- [Étape 4 — Les DTOs](#étape-4--les-dtos)
- [Étape 5 — Le contrôleur](#étape-5--le-contrôleur)
- [Étape 6 — Le module + AppModule](#étape-6--le-module--appmodule)
- [Étape 7 — Vérifier que ça marche & ce qu'on verra plus tard](#étape-7--vérifier-que-ça-marche--ce-quon-verra-plus-tard)

---

## 0 · Avant de commencer

- API démarrée, base à jour, tables des modules 02 à 07 présentes (`contacts`, `products`, `warehouses`, `stock_levels`, `quotes`, `orders`, `invoices`) — le module 08 appliqué pour que `PAID` existe en base.
- Pour les rappels sur le socle : section A de `mini-DEV-01`.

### Les nouveautés de ce module

1. **Le module SANS persistance.** Aucune entité, aucune table, aucune migration : le tableau de bord n'EXISTE pas en base — c'est une VUE calculée à la demande. La leçon du module 07 (`remainingAmount` jamais stocké) poussée à l'échelle d'un écran entier : une donnée dérivable stockée finit toujours par diverger ; ici, TOUT est dérivé.
2. **Le SQL brut, assumé.** Depuis le module 02, les repositories et le QueryBuilder portent toutes les lectures métier. Pour le reporting transverse (SUM, COUNT, GROUP BY, TOP, sur les tables de QUATRE modules), on descend d'un étage : `DataSource.query()` et du T-SQL paramétré. Le bon outil pour le bon travail — un dashboard n'est pas un cas d'usage métier, c'est de l'agrégation.
3. **Aucun import de module métier.** Le service de requêtes lit les TABLES des autres modules, pas leurs classes : `DashboardModule` n'importe RIEN (la `DataSource` de TypeORM est globale). Zéro dépendance NestJS ajoutée au graphe — le dashboard peut disparaître demain sans qu'un seul module le remarque.
4. **`Promise.all` : la latence du plus lent, pas la somme.** Huit requêtes indépendantes lancées ensemble — l'écran répond en une seule aller-retour « le plus lent gagne », pas en huit séquentiels.
5. **La composition de DTOs.** `DashboardResponseDto` assemble 7 sous-DTOs — première réponse composite du projet, et le contrat Swagger reste complet jusqu'à la feuille.

**Choix assumés de cette version** : pas de cache (chaque appel recalcule tout — parfait pour une démo, à noter pour la prod), pas de bornes de dates paramétrables (mois courant / mois précédent / année en cours, point), audit optionnel non branché. Détail au § final.

**Convention** : le chiffre d'affaires = factures de type `INVOICE` au statut `PAID` uniquement — pas les avoirs (ils viendront en déduction au niveau min-), pas les factures envoyées non payées (c'est de la créance, pas du CA encaissé). Tous les montants en EUR, arrondis au centime (`roundMoney`).

---

## B · Ce qu'on va construire

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/dashboard` | ADMIN, MANAGER | Toutes les métriques en un appel ; query `stockAlertThreshold` (défaut : 5) |

**La réponse, bloc par bloc** :

```
revenue          : CA encaissé — mois courant, mois précédent, année en cours
invoices         : créances — SENT, OVERDUE, PARTIALLY_PAID (nombre + reste à encaisser)
activeOrders     : commandes IN_PROGRESS (en cours de livraison)
quotesPipeline   : devis DRAFT / SENT / ACCEPTED (le pipe commercial)
topCustomers     : top 5 clients par CA encaissé
recentOrders     : les 5 dernières commandes (avec le nom du contact)
recentInvoices   : les 5 dernières factures (avec le reste à payer)
stockAlerts      : produits sous le seuil, par entrepôt (les services exclus)
```

**Les règles métier incluses** :

- CA : `type = 'INVOICE'` ET `status = 'PAID'` uniquement, sommé sur la date d'ÉMISSION (le sens comptable, comme les filtres du module 07) ;
- créances : montants = `total_ttc - paid_amount` (le reste à encaisser, pas le TTC brut — une facture à moitié payée ne « pèse » que sa moitié) ;
- top clients : par CA encaissé, 5 premiers, nom du client joint ;
- alertes de stock : `quantity < seuil`, produits de type `PRODUCT` uniquement (un service n'a pas de stock), actifs et non supprimés ;
- les 8 requêtes partent en `Promise.all` ;
- tous les montants arrondis au centime.

**14 fichiers créés, 1 modifié** (`app.module.ts`), **0 migration** — une première.

---

## Étape 1 — Le domaine : les interfaces des métriques

> Crée l'arborescence `src/modules/dashboard/domain/`.

Pas d'entité, pas de classe : le domaine de ce module, ce sont les FORMES des résultats. Des interfaces pures — le service de requêtes les remplit, le use case les assemble, les DTOs les exposent.

### ➕ Créer `src/modules/dashboard/domain/dashboard-metrics.ts`

```typescript
/**
 * Formes des métriques du tableau de bord.
 *
 * RIEN n'est persisté : chaque valeur est calculée à la volée par une
 * requête agrégée. Interfaces pures — aucune dépendance.
 */

/** Chiffre d'affaires ENCAISSÉ (factures INVOICE au statut PAID). */
export interface RevenueStats {
  /** CA TTC du mois courant. */
  currentMonth: number;
  /** CA TTC du mois précédent (comparaison). */
  lastMonth: number;
  /** CA TTC depuis le 1er janvier (year-to-date). */
  ytd: number;
}

/** Les créances : ce que les clients doivent encore. */
export interface InvoicesSummary {
  /** Factures SENT (envoyées, rien d'encaissé). */
  pendingCount: number;
  pendingAmount: number;
  /** Factures OVERDUE (échéance dépassée). */
  overdueCount: number;
  overdueAmount: number;
  /** Factures PARTIALLY_PAID (acompte reçu). */
  partialCount: number;
  partialAmount: number;
}

/** Le pipe commercial : les devis par étape. */
export interface QuotesPipeline {
  draftCount: number;
  sentCount: number;
  acceptedCount: number;
}

/** Un client du top 5 (par CA encaissé). */
export interface TopCustomer {
  contactId: string;
  companyName: string;
  /** Somme TTC des factures PAID. */
  totalRevenue: number;
}

/** Une commande récente (liste d'activité). */
export interface RecentOrder {
  id: string;
  number: string;
  type: string;
  status: string;
  /** Nom du contact (joint). */
  contact: string;
  totalTTC: number;
  createdAt: Date;
}

/** Une facture récente (liste d'activité). */
export interface RecentInvoice {
  id: string;
  number: string;
  status: string;
  /** Nom du client (joint). */
  contact: string;
  totalTTC: number;
  /** Reste à payer (total_ttc - paid_amount). */
  remainingAmount: number;
  dueDate: Date;
}

/** Un produit sous le seuil de stock, dans un entrepôt donné. */
export interface StockAlert {
  productId: string;
  sku: string;
  name: string;
  warehouseId: string;
  /** Nom de l'entrepôt (joint). */
  warehouse: string;
  quantity: number;
  /** Le seuil utilisé pour cette alerte. */
  threshold: number;
}

/** La réponse complète du tableau de bord. */
export interface DashboardMetrics {
  revenue: RevenueStats;
  invoices: InvoicesSummary;
  /** Commandes IN_PROGRESS (parties en livraison). */
  activeOrders: number;
  quotesPipeline: QuotesPipeline;
  /** Top 5 clients par CA encaissé. */
  topCustomers: TopCustomer[];
  /** Les 5 dernières commandes. */
  recentOrders: RecentOrder[];
  /** Les 5 dernières factures. */
  recentInvoices: RecentInvoice[];
  stockAlerts: StockAlert[];
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 2 — Le service de requêtes SQL

> Crée l'arborescence `src/modules/dashboard/infrastructure/`.

LE fichier du module. Chaque méthode = une requête T-SQL paramétrée via `DataSource.query()`. Trois règles à ne jamais lâcher :

- **paramètres TOUJOURS liés** (`@0`, `@1`… + tableau de valeurs) — jamais de concaténation, même pour un entier : l'injection SQL ne prévient pas ;
- **`Number(...)` + `roundMoney` sur tout agrégat** : une requête brute n'hydrate pas d'entité, donc AUCUN transformer de colonne ne s'applique — `SUM(decimal)` arrive en chaîne selon le driver (le piège déjà croisé avec `sumByInvoice` au module 08) ;
- **`deleted_at IS NULL` partout où la table est auditable** : le QueryBuilder des repositories n'est plus là pour filtrer les soft-deletes à notre place.

### ➕ Créer `src/modules/dashboard/infrastructure/dashboard-query.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { roundMoney } from '../../../common/money/money';
import {
  InvoicesSummary,
  QuotesPipeline,
  RecentInvoice,
  RecentOrder,
  RevenueStats,
  StockAlert,
  TopCustomer,
} from '../domain/dashboard-metrics';

/**
 * Requêtes agrégées du tableau de bord — du T-SQL brut, paramétré.
 *
 * Pourquoi pas les repositories ? Parce qu'aucun cas d'usage MÉTIER ne
 * demande « le CA du mois » ou « le top 5 clients » : c'est du
 * reporting transverse, qui lit les TABLES de quatre modules d'un
 * coup. Le QueryBuilder n'apporterait ici que du bruit — et les ports
 * des modules n'ont pas à s'encombrer de méthodes de dashboard.
 *
 * La DataSource de TypeORM est GLOBALE (TypeOrmModule.forRoot) : ce
 * service s'injecte sans importer le moindre module métier.
 */
@Injectable()
export class DashboardQueryService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /** CA encaissé : mois courant, mois précédent, année en cours. */
  async getRevenueStats(): Promise<RevenueStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [currentMonth, lastMonth, ytd] = await Promise.all([
      this.sumPaidInvoicesBetween(startOfMonth, startOfNextMonth),
      this.sumPaidInvoicesBetween(startOfLastMonth, startOfMonth),
      this.sumPaidInvoicesBetween(startOfYear, startOfNextMonth),
    ]);

    return { currentMonth, lastMonth, ytd };
  }

  /**
   * Somme TTC des factures PAID émises dans [from, to).
   * Sur la date d'ÉMISSION : le sens comptable (module 07), pas la
   * date technique de création ni la date du paiement.
   */
  private async sumPaidInvoicesBetween(from: Date, to: Date): Promise<number> {
    const rows: { total: string | number | null }[] =
      await this.dataSource.query(
        `SELECT SUM(total_ttc) AS total
           FROM invoices
          WHERE type = 'INVOICE'
            AND status = 'PAID'
            AND deleted_at IS NULL
            AND issue_date >= @0
            AND issue_date < @1`,
        [from, to],
      );
    return roundMoney(Number(rows[0]?.total ?? 0));
  }

  /**
   * Les créances, par statut. Montant = total_ttc - paid_amount (le
   * RESTE à encaisser) : une facture à moitié payée ne pèse que sa
   * moitié dans le trou de trésorerie.
   */
  async getInvoicesSummary(): Promise<InvoicesSummary> {
    const rows: {
      status: string;
      count: number;
      amount: string | number | null;
    }[] = await this.dataSource.query(
      `SELECT status,
              COUNT(*) AS count,
              SUM(total_ttc - paid_amount) AS amount
         FROM invoices
        WHERE type = 'INVOICE'
          AND deleted_at IS NULL
          AND status IN ('SENT', 'OVERDUE', 'PARTIALLY_PAID')
        GROUP BY status`,
    );

    const byStatus = new Map(rows.map((row) => [row.status, row]));
    const count = (status: string): number =>
      Number(byStatus.get(status)?.count ?? 0);
    const amount = (status: string): number =>
      roundMoney(Number(byStatus.get(status)?.amount ?? 0));

    return {
      pendingCount: count('SENT'),
      pendingAmount: amount('SENT'),
      overdueCount: count('OVERDUE'),
      overdueAmount: amount('OVERDUE'),
      partialCount: count('PARTIALLY_PAID'),
      partialAmount: amount('PARTIALLY_PAID'),
    };
  }

  /** Le pipe commercial : devis par étape (avant refus/expiration). */
  async getQuotesPipeline(): Promise<QuotesPipeline> {
    const rows: { status: string; count: number }[] =
      await this.dataSource.query(
        `SELECT status, COUNT(*) AS count
           FROM quotes
          WHERE deleted_at IS NULL
            AND status IN ('DRAFT', 'SENT', 'ACCEPTED')
          GROUP BY status`,
      );

    const byStatus = new Map(rows.map((row) => [row.status, row.count]));

    return {
      draftCount: Number(byStatus.get('DRAFT') ?? 0),
      sentCount: Number(byStatus.get('SENT') ?? 0),
      acceptedCount: Number(byStatus.get('ACCEPTED') ?? 0),
    };
  }

  /** Commandes parties en livraison (IN_PROGRESS). */
  async getActiveOrdersCount(): Promise<number> {
    const rows: { count: number }[] = await this.dataSource.query(
      `SELECT COUNT(*) AS count
         FROM orders
        WHERE status = 'IN_PROGRESS'
          AND deleted_at IS NULL`,
    );
    return Number(rows[0]?.count ?? 0);
  }

  /** Top clients par CA encaissé (factures PAID). */
  async getTopCustomers(limit: number): Promise<TopCustomer[]> {
    const rows: {
      contactId: string;
      companyName: string;
      totalRevenue: string | number;
    }[] = await this.dataSource.query(
      `SELECT TOP (@0)
              i.customer_id AS contactId,
              c.company_name AS companyName,
              SUM(i.total_ttc) AS totalRevenue
         FROM invoices i
        INNER JOIN contacts c ON c.id = i.customer_id
        WHERE i.type = 'INVOICE'
          AND i.status = 'PAID'
          AND i.deleted_at IS NULL
        GROUP BY i.customer_id, c.company_name
        ORDER BY SUM(i.total_ttc) DESC`,
      [limit],
    );

    return rows.map((row) => ({
      contactId: row.contactId,
      companyName: row.companyName,
      totalRevenue: roundMoney(Number(row.totalRevenue)),
    }));
  }

  /** Les N dernières commandes, contact joint. */
  async getRecentOrders(limit: number): Promise<RecentOrder[]> {
    const rows: {
      id: string;
      number: string;
      type: string;
      status: string;
      contact: string;
      totalTTC: string | number;
      createdAt: Date;
    }[] = await this.dataSource.query(
      `SELECT TOP (@0)
              o.id AS id,
              o.number AS number,
              o.type AS type,
              o.status AS status,
              c.company_name AS contact,
              o.total_ttc AS totalTTC,
              o.created_at AS createdAt
         FROM orders o
        INNER JOIN contacts c ON c.id = o.contact_id
        WHERE o.deleted_at IS NULL
        ORDER BY o.created_at DESC`,
      [limit],
    );

    return rows.map((row) => ({
      ...row,
      totalTTC: roundMoney(Number(row.totalTTC)),
    }));
  }

  /**
   * Les N dernières factures (type INVOICE : un avoir n'est pas une
   * créance, il n'a rien à faire dans une liste de suivi d'encours).
   */
  async getRecentInvoices(limit: number): Promise<RecentInvoice[]> {
    const rows: {
      id: string;
      number: string;
      status: string;
      contact: string;
      totalTTC: string | number;
      remainingAmount: string | number;
      dueDate: Date;
    }[] = await this.dataSource.query(
      `SELECT TOP (@0)
              i.id AS id,
              i.number AS number,
              i.status AS status,
              c.company_name AS contact,
              i.total_ttc AS totalTTC,
              (i.total_ttc - i.paid_amount) AS remainingAmount,
              i.due_date AS dueDate
         FROM invoices i
        INNER JOIN contacts c ON c.id = i.customer_id
        WHERE i.type = 'INVOICE'
          AND i.deleted_at IS NULL
        ORDER BY i.created_at DESC`,
      [limit],
    );

    return rows.map((row) => ({
      ...row,
      totalTTC: roundMoney(Number(row.totalTTC)),
      remainingAmount: roundMoney(Number(row.remainingAmount)),
    }));
  }

  /**
   * Produits sous le seuil, par entrepôt. Produits STOCKÉS uniquement
   * (type PRODUCT — un service n'a pas de stock), actifs et non
   * supprimés : on n'alerte pas sur un produit retiré du catalogue.
   */
  async getStockAlerts(threshold: number): Promise<StockAlert[]> {
    const rows: {
      productId: string;
      sku: string;
      name: string;
      warehouseId: string;
      warehouse: string;
      quantity: number;
    }[] = await this.dataSource.query(
      `SELECT p.id AS productId,
              p.sku AS sku,
              p.name AS name,
              w.id AS warehouseId,
              w.name AS warehouse,
              sl.quantity AS quantity
         FROM stock_levels sl
        INNER JOIN products p ON p.id = sl.product_id
        INNER JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE sl.quantity < @0
          AND p.type = 'PRODUCT'
          AND p.is_active = 1
          AND p.deleted_at IS NULL
        ORDER BY sl.quantity ASC`,
      [threshold],
    );

    return rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      threshold,
    }));
  }
}
```

> 📌 **Pourquoi `TOP (@0)` et pas `TOP 5` en dur ?** Parce que la limite est un PARAMÈTRE (le use case la fixe) — et qu'on ne concatène JAMAIS une valeur dans du SQL, même un entier qu'on « sait » propre. Les parenthèses sont obligatoires en T-SQL quand `TOP` reçoit une variable.

> 💡 Un produit peut ne figurer dans AUCUN `stock_levels` (jamais approvisionné) : il n'apparaîtra pas dans les alertes, même à 0. Assumé au niveau mini — le « stock zéro absolu » (LEFT JOIN depuis `products`) est une amélioration min-.

**✅ Point de contrôle** : `npm run build`

---

## Étape 3 — Le cas d'utilisation

> Crée le dossier `src/modules/dashboard/application/`.

### ➕ Créer `src/modules/dashboard/application/get-dashboard.use-case.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { DashboardMetrics } from '../domain/dashboard-metrics';
import { DashboardQueryService } from '../infrastructure/dashboard-query.service';

/** Seuil d'alerte de stock par défaut. */
const DEFAULT_STOCK_ALERT_THRESHOLD = 5;

/** Top clients et listes d'activité : 5 lignes chacun. */
const TOP_LIMIT = 5;

/**
 * Cas d'utilisation : assembler le tableau de bord.
 *
 * Les 8 requêtes sont INDÉPENDANTES : Promise.all les lance ensemble,
 * la réponse arrive au rythme de la plus lente — pas de la somme des
 * huit. Aucune règle métier ici : de la lecture pure, assemblée.
 */
@Injectable()
export class GetDashboardUseCase {
  constructor(private readonly queryService: DashboardQueryService) {}

  async execute(
    stockAlertThreshold: number = DEFAULT_STOCK_ALERT_THRESHOLD,
  ): Promise<DashboardMetrics> {
    const [
      revenue,
      invoices,
      quotesPipeline,
      activeOrders,
      topCustomers,
      recentOrders,
      recentInvoices,
      stockAlerts,
    ] = await Promise.all([
      this.queryService.getRevenueStats(),
      this.queryService.getInvoicesSummary(),
      this.queryService.getQuotesPipeline(),
      this.queryService.getActiveOrdersCount(),
      this.queryService.getTopCustomers(TOP_LIMIT),
      this.queryService.getRecentOrders(TOP_LIMIT),
      this.queryService.getRecentInvoices(TOP_LIMIT),
      this.queryService.getStockAlerts(stockAlertThreshold),
    ]);

    return {
      revenue,
      invoices,
      activeOrders,
      quotesPipeline,
      topCustomers,
      recentOrders,
      recentInvoices,
      stockAlerts,
    };
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 4 — Les DTOs

> Crée le dossier `src/modules/dashboard/presentation/dto/`.

Sept DTOs de forme (le contrat Swagger de chaque bloc), un DTO composite qui les assemble, et le DTO de query. Les formes étant IDENTIQUES aux interfaces du domaine, les blocs s'affectent directement — pas de mapping champ à champ, sauf pour le composite.

### ➕ Créer `src/modules/dashboard/presentation/dto/revenue-stats.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

/** CA encaissé (factures INVOICE au statut PAID). */
export class RevenueStatsDto {
  @ApiProperty({ description: 'CA TTC du mois courant.', example: 12480.5 })
  currentMonth!: number;

  @ApiProperty({ description: 'CA TTC du mois précédent.', example: 9860 })
  lastMonth!: number;

  @ApiProperty({ description: 'CA TTC depuis le 1er janvier.', example: 87310.25 })
  ytd!: number;
}
```

### ➕ Créer `src/modules/dashboard/presentation/dto/invoices-summary.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

/** Les créances — montants = reste à encaisser (TTC - payé). */
export class InvoicesSummaryDto {
  @ApiProperty({ description: 'Factures SENT.', example: 3 })
  pendingCount!: number;

  @ApiProperty({ example: 4820.4 })
  pendingAmount!: number;

  @ApiProperty({ description: 'Factures OVERDUE.', example: 1 })
  overdueCount!: number;

  @ApiProperty({ example: 1094.76 })
  overdueAmount!: number;

  @ApiProperty({ description: 'Factures PARTIALLY_PAID.', example: 2 })
  partialCount!: number;

  @ApiProperty({ example: 730.15 })
  partialAmount!: number;
}
```

### ➕ Créer `src/modules/dashboard/presentation/dto/quotes-pipeline.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

/** Le pipe commercial : devis par étape. */
export class QuotesPipelineDto {
  @ApiProperty({ example: 4 })
  draftCount!: number;

  @ApiProperty({ example: 2 })
  sentCount!: number;

  @ApiProperty({ example: 1 })
  acceptedCount!: number;
}
```

### ➕ Créer `src/modules/dashboard/presentation/dto/top-customer.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

/** Un client du top 5 (par CA encaissé). */
export class TopCustomerDto {
  @ApiProperty({ description: 'Identifiant du contact (UUID).' })
  contactId!: string;

  @ApiProperty({ example: 'ACME Industries' })
  companyName!: string;

  @ApiProperty({ description: 'Somme TTC des factures PAID.', example: 15230.8 })
  totalRevenue!: number;
}
```

### ➕ Créer `src/modules/dashboard/presentation/dto/recent-order.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

/** Une commande récente. */
export class RecentOrderDto {
  @ApiProperty({ description: 'Identifiant de la commande (UUID).' })
  id!: string;

  @ApiProperty({ example: 'CMD-2026-0003' })
  number!: string;

  @ApiProperty({ example: 'CUSTOMER' })
  type!: string;

  @ApiProperty({ example: 'IN_PROGRESS' })
  status!: string;

  @ApiProperty({ description: 'Nom du contact.', example: 'ACME Industries' })
  contact!: string;

  @ApiProperty({ example: 839.76 })
  totalTTC!: number;

  @ApiProperty()
  createdAt!: Date;
}
```

### ➕ Créer `src/modules/dashboard/presentation/dto/recent-invoice.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

/** Une facture récente. */
export class RecentInvoiceDto {
  @ApiProperty({ description: 'Identifiant de la facture (UUID).' })
  id!: string;

  @ApiProperty({ example: 'FAC-2026-0002' })
  number!: string;

  @ApiProperty({ example: 'PARTIALLY_PAID' })
  status!: string;

  @ApiProperty({ description: 'Nom du client.', example: 'ACME Industries' })
  contact!: string;

  @ApiProperty({ example: 1094.76 })
  totalTTC!: number;

  @ApiProperty({ description: 'Reste à payer.', example: 594.76 })
  remainingAmount!: number;

  @ApiProperty({ description: "Date d'échéance." })
  dueDate!: Date;
}
```

### ➕ Créer `src/modules/dashboard/presentation/dto/stock-alert.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

/** Un produit sous le seuil de stock, dans un entrepôt. */
export class StockAlertDto {
  @ApiProperty({ description: 'Identifiant du produit (UUID).' })
  productId!: string;

  @ApiProperty({ example: 'SKU-ECR-27Q' })
  sku!: string;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  name!: string;

  @ApiProperty({ description: "Identifiant de l'entrepôt (UUID)." })
  warehouseId!: string;

  @ApiProperty({ description: "Nom de l'entrepôt.", example: 'Entrepôt Paris Nord' })
  warehouse!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ description: 'Seuil utilisé pour cette alerte.', example: 5 })
  threshold!: number;
}
```

### ➕ Créer `src/modules/dashboard/presentation/dto/dashboard-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Query string de GET /dashboard.
 * @Type(() => Number) : la conversion implicite est désactivée dans le
 * ValidationPipe global (comme pour la pagination du socle) — sans lui,
 * "5" resterait une chaîne et IsInt refuserait.
 */
export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: "Seuil des alertes de stock (quantité strictement inférieure).",
    default: 5,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le paramètre "stockAlertThreshold" doit être un entier.' })
  @Min(0, {
    message: 'Le paramètre "stockAlertThreshold" ne peut pas être négatif.',
  })
  stockAlertThreshold?: number;
}
```

### ➕ Créer `src/modules/dashboard/presentation/dto/dashboard-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { DashboardMetrics } from '../../domain/dashboard-metrics';
import { InvoicesSummaryDto } from './invoices-summary.dto';
import { QuotesPipelineDto } from './quotes-pipeline.dto';
import { RecentInvoiceDto } from './recent-invoice.dto';
import { RecentOrderDto } from './recent-order.dto';
import { RevenueStatsDto } from './revenue-stats.dto';
import { StockAlertDto } from './stock-alert.dto';
import { TopCustomerDto } from './top-customer.dto';

/**
 * La réponse composite du tableau de bord : sept blocs + un compteur.
 * Les formes des blocs sont identiques aux interfaces du domaine —
 * l'affectation est directe, le contrat Swagger reste complet.
 */
export class DashboardResponseDto {
  @ApiProperty({ type: RevenueStatsDto })
  revenue!: RevenueStatsDto;

  @ApiProperty({ type: InvoicesSummaryDto })
  invoices!: InvoicesSummaryDto;

  @ApiProperty({ description: 'Commandes IN_PROGRESS.', example: 2 })
  activeOrders!: number;

  @ApiProperty({ type: QuotesPipelineDto })
  quotesPipeline!: QuotesPipelineDto;

  @ApiProperty({ type: [TopCustomerDto] })
  topCustomers!: TopCustomerDto[];

  @ApiProperty({ type: [RecentOrderDto] })
  recentOrders!: RecentOrderDto[];

  @ApiProperty({ type: [RecentInvoiceDto] })
  recentInvoices!: RecentInvoiceDto[];

  @ApiProperty({ type: [StockAlertDto] })
  stockAlerts!: StockAlertDto[];

  static fromMetrics(metrics: DashboardMetrics): DashboardResponseDto {
    const dto = new DashboardResponseDto();
    dto.revenue = metrics.revenue;
    dto.invoices = metrics.invoices;
    dto.activeOrders = metrics.activeOrders;
    dto.quotesPipeline = metrics.quotesPipeline;
    dto.topCustomers = metrics.topCustomers;
    dto.recentOrders = metrics.recentOrders;
    dto.recentInvoices = metrics.recentInvoices;
    dto.stockAlerts = metrics.stockAlerts;
    return dto;
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 5 — Le contrôleur

### ➕ Créer `src/modules/dashboard/presentation/dashboard.controller.ts`

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { GetDashboardUseCase } from '../application/get-dashboard.use-case';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

/**
 * Contrôleur du tableau de bord — UNE route, TOUT l'écran.
 * ADMIN/MANAGER : les chiffres d'affaires et créances ne sont pas de
 * la consultation d'équipe.
 */
@ApiTags('Tableau de bord')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly getDashboardUseCase: GetDashboardUseCase) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Toutes les métriques en un appel',
    description:
      'CA (mois courant / précédent / YTD), créances par statut, ' +
      'commandes actives, pipe des devis, top 5 clients, activité ' +
      'récente, alertes de stock. Calculé à la volée (8 requêtes en ' +
      'parallèle), aucun cache.',
  })
  @ApiOkResponse({ type: DashboardResponseDto })
  async getDashboard(
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    const metrics = await this.getDashboardUseCase.execute(
      query.stockAlertThreshold,
    );
    return DashboardResponseDto.fromMetrics(metrics);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 6 — Le module + AppModule

### ➕ Créer `src/modules/dashboard/dashboard.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { GetDashboardUseCase } from './application/get-dashboard.use-case';
import { DashboardQueryService } from './infrastructure/dashboard-query.service';
import { DashboardController } from './presentation/dashboard.controller';

/**
 * Module du tableau de bord.
 *
 * AUCUN import : pas de TypeOrmModule.forFeature (aucune entité), pas
 * de module métier (le service lit les TABLES, pas les classes — la
 * DataSource de TypeORM est globale). Le module le plus léger du
 * projet : il peut disparaître sans qu'un seul autre le remarque.
 *
 * Rien n'est exporté : personne ne consomme un tableau de bord.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardQueryService, GetDashboardUseCase],
})
export class DashboardModule {}
```

### ✏️ Modifier `src/app.module.ts`

**1)** Ajoute l'import :

```typescript
import { DashboardModule } from './modules/dashboard/dashboard.module';
```

**2)** Dans le tableau `imports`, après `PaymentsModule` :

```typescript
    InvoicesModule,
    PaymentsModule,
    DashboardModule,
    AuthenticationModule,
```

**✅ Point de contrôle** :

```bash
npm run build
npm run start:dev
```

Les logs listent la route `/api/v1/dashboard` ; Swagger affiche la section « Tableau de bord ».

---

## Étape 7 — Vérifier que ça marche & ce qu'on verra plus tard

### 7.1 Parcours manuel (PowerShell)

Le tableau de bord ne montre que ce qui EXISTE : sur une base vide, tout est à zéro (et c'est déjà un test réussi — pas d'erreur, des zéros propres). Pour une démo parlante, déroule d'abord les parcours des modules 04 à 08 (ou leurs collections Postman) — le script ci-dessous fabrique un minimum d'activité puis interroge l'écran.

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

# 2. Un minimum d'activité : client, produit, facture émise PUIS PAYÉE
$client = Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"type":"CUSTOMER","companyName":"ACME Industries","email":"compta@acme-industries.fr"}'
$prod = Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Écran Dell 27\" QHD","type":"PRODUCT","unit":"UNIT","unitPrice":349.90}'
$fac = Invoke-RestMethod -Method Post -Uri "$base/invoices" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"customerId":"' + $client.data.id + '","lines":[{"productId":"' + $prod.data.id + '","quantity":2}]}')
Invoke-RestMethod -Method Post -Uri "$base/invoices/$($fac.data.id)/send" -Headers $headers | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/payments" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"invoiceId":"' + $fac.data.id + '","amount":' + $fac.data.totalTTC + ',"method":"BANK_TRANSFER"}') | Out-Null
# → la facture est PAID : du CA pour le dashboard

# 3. Un devis (pipe commercial) et un entrepôt presque vide (alerte stock)
Invoke-RestMethod -Method Post -Uri "$base/quotes" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"customerId":"' + $client.data.id + '","lines":[{"productId":"' + $prod.data.id + '","quantity":1}]}') | Out-Null
$wh = Invoke-RestMethod -Method Post -Uri "$base/warehouses" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Entrepôt Paris Nord","code":"WH-PARIS"}'
Invoke-RestMethod -Method Post -Uri "$base/stock/in" -Headers $headers `
  -ContentType 'application/json' `
  -Body ('{"productId":"' + $prod.data.id + '","warehouseId":"' + $wh.data.id + '","quantity":2}') | Out-Null
# → 2 en stock, sous le seuil par défaut (5)

# 4. LE tableau de bord
$dash = Invoke-RestMethod -Uri "$base/dashboard" -Headers $headers
$dash.data.revenue.currentMonth        # → 839.76 (le CA du mois : la facture payée)
$dash.data.revenue.ytd                 # → 839.76
$dash.data.quotesPipeline.draftCount   # → 1 (le devis)
$dash.data.topCustomers[0].companyName # → ACME Industries
$dash.data.recentInvoices[0].status    # → PAID
$dash.data.stockAlerts[0].quantity     # → 2 (sous le seuil de 5)

# 5. Seuil personnalisé : à 1, plus d'alerte (2 n'est pas < 1)
(Invoke-RestMethod -Uri "$base/dashboard?stockAlertThreshold=1" -Headers $headers).data.stockAlerts.Count
# → 0

# 6. Validation : seuil négatif → 400
try {
  Invoke-RestMethod -Uri "$base/dashboard?stockAlertThreshold=-1" -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : BadRequest (400)
}
```

Même parcours possible à la souris dans **Swagger**, ou via la collection **`postman-09-tableau-de-bord.json`**.

> 💡 Vérifie aussi la parallélisation à l'œil nu : dans les logs Pino, les 8 requêtes SQL du dashboard partent d'un bloc (même milliseconde ou presque) — pas en cascade.

### 7.2 Les pièges croisés en route (mémo)

| Piège | Parade |
|---|---|
| Compter les avoirs dans le CA | `type = 'INVOICE'` dans TOUTES les requêtes de factures |
| CA = factures envoyées | Non : `status = 'PAID'` — une créance n'est pas du chiffre encaissé |
| Créances au TTC brut | `SUM(total_ttc - paid_amount)` : le reste à encaisser, pas le montant facial |
| `SUM()`/`COUNT()` bruts qui ignorent les transformers | `Number(...)` + `roundMoney` sur chaque agrégat (pas d'entité hydratée = pas de transformer) |
| Les soft-deletes qui reviennent dans les chiffres | `deleted_at IS NULL` dans chaque requête (le QueryBuilder ne filtre plus pour nous) |
| Concaténer la limite « parce que c'est un entier » | JAMAIS : `TOP (@0)` + paramètre lié |
| Huit requêtes en cascade | `Promise.all` — la latence du plus lent, pas la somme |
| `?stockAlertThreshold=10` reçu comme chaîne | `@Type(() => Number)` (la conversion implicite est désactivée dans le pipe global) |
| Les services dans les alertes de stock | `p.type = 'PRODUCT'` — un service n'a pas de stock |

### 7.3 Ce qu'on verra plus tard (rien n'est perdu)

| Différé | Pourquoi ce n'est pas bloquant | Niveau |
|---|---|---|
| **Cache** (30-60 s) | Chaque appel recalcule tout — parfait en démo, à cacher en prod (la spec le note explicitement) | 🟡 min- |
| **Avoirs déduits du CA** | Le CA compte les factures PAID ; soustraire les avoirs émis est une règle comptable à brancher dans `sumPaidInvoicesBetween` | 🟡 min- |
| **Bornes de dates paramétrables** (`?from=&to=`) | Mois courant / précédent / YTD couvrent la démo | 🟡 min- |
| **Stock zéro absolu** (produits jamais approvisionnés) | `LEFT JOIN` depuis `products` au lieu de partir de `stock_levels` | 🟡 min- |
| **Seuil d'alerte PAR PRODUIT** (colonne `alert_threshold`) | Le seuil global paramétrable couvre le besoin de démo | 🟡 min- |
| **Audit** (`dashboard.viewed`) | Optionnel dans la spec — de la lecture pure, sans enjeu de traçabilité | 🟡 min- |
| **Tests** (unit : périodes du CA, seuil et exclusion des services ; e2e : structure et cohérence) | L'application fonctionne ; garantie long terme | 🔴 complet |

### 7.4 Ce que ce module t'a appris de nouveau

1. **Le module sans persistance** : aucune entité, aucune migration — un écran est une PROJECTION des données des autres, jamais une copie (la copie diverge, la projection est toujours juste).
2. **Descendre au SQL quand c'est le bon outil** : les repositories pour le métier, `DataSource.query()` paramétré pour le reporting transverse — sans jamais transiger sur les paramètres liés, les `Number()` et les `deleted_at`.
3. **Zéro dépendance de module** : lire les tables des autres sans importer leurs modules — la DataSource globale suffit, le graphe NestJS reste propre.
4. **`Promise.all` pour les lectures indépendantes** : huit requêtes, la latence d'une seule.
5. **La réponse composite** : un DTO qui en assemble sept, et Swagger documente l'arbre entier — le front n'a qu'un appel à faire.

---

*Fin du guide mini-DEV-09. Prochain module : le transversal (10) — recherche globale, exports CSV et historique.*
