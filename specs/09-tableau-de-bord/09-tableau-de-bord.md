# 09 · Tableau de Bord

> **Dépendances** : tous les modules précédents  
> **Modules réutilisés** : `Audit` (optionnel)

---

## Contexte

Le tableau de bord agrège des métriques clés depuis tous les modules. Ce n'est **pas** une entité persistante : toutes les données sont calculées à la volée via des requêtes optimisées. L'objectif est de montrer des indicateurs pertinents pour une démo ERP sans alourdir l'architecture.

---

## 1 · Domaine

Pas d'entité propre. Le domaine expose uniquement les interfaces des résultats.

- [ ] Créer `src/modules/dashboard/domain/dashboard-metrics.ts`
  ```ts
  export interface RevenueStats {
    currentMonth : number;   // TTC facturé (PAID) ce mois
    lastMonth    : number;
    ytd          : number;   // Year-to-date
  }

  export interface InvoicesSummary {
    pendingCount    : number;  // SENT
    pendingAmount   : number;
    overdueCount    : number;  // OVERDUE
    overdueAmount   : number;
    partialCount    : number;  // PARTIALLY_PAID
    partialAmount   : number;
  }

  export interface QuotesPipeline {
    draftCount    : number;
    sentCount     : number;
    acceptedCount : number;
  }

  export interface TopCustomer {
    contactId    : string;
    companyName  : string;
    totalRevenue : number;   // somme TTC des factures PAID
  }

  export interface RecentOrder {
    id        : string;
    number    : string;
    type      : string;
    status    : string;
    contact   : string;
    totalTTC  : number;
    createdAt : Date;
  }

  export interface RecentInvoice {
    id            : string;
    number        : string;
    status        : string;
    contact       : string;
    totalTTC      : number;
    remainingAmount : number;
    dueDate       : Date;
  }

  export interface StockAlert {
    productId   : string;
    sku         : string;
    name        : string;
    warehouseId : string;
    warehouse   : string;
    quantity    : number;
    threshold   : number;
  }

  export interface DashboardMetrics {
    revenue        : RevenueStats;
    invoices       : InvoicesSummary;
    activeOrders   : number;        // commandes IN_PROGRESS
    quotesPipeline : QuotesPipeline;
    topCustomers   : TopCustomer[]; // top 5
    recentOrders   : RecentOrder[]; // 5 dernières
    recentInvoices : RecentInvoice[]; // 5 dernières
    stockAlerts    : StockAlert[];
  }
  ```

---

## 2 · Infrastructure — Queries

- [ ] Créer `src/modules/dashboard/infrastructure/dashboard-query.service.ts`
  - Utilise `DataSource` directement pour les requêtes SQL agrégées (pas de N+1)
  - Méthodes :
    - `getRevenueStats(): Promise<RevenueStats>`
      - `SELECT SUM(total_ttc) WHERE status='PAID' AND MONTH/YEAR`
    - `getInvoicesSummary(): Promise<InvoicesSummary>`
      - `GROUP BY status WHERE status IN ('SENT','OVERDUE','PARTIALLY_PAID')`
    - `getQuotesPipeline(): Promise<QuotesPipeline>`
      - `COUNT GROUP BY status WHERE status IN ('DRAFT','SENT','ACCEPTED')`
    - `getActiveOrdersCount(): Promise<number>`
    - `getTopCustomers(limit: 5): Promise<TopCustomer[]>`
      - Join `invoices` + `contacts` WHERE status='PAID' GROUP BY customerId ORDER BY SUM(totalTTC) DESC
    - `getRecentOrders(limit: 5): Promise<RecentOrder[]>`
    - `getRecentInvoices(limit: 5): Promise<RecentInvoice[]>`
    - `getStockAlerts(threshold: number): Promise<StockAlert[]>`
      - Join `stock_levels` + `products` + `warehouses` WHERE quantity < threshold AND product.type='PRODUCT'

---

## 3 · Application — Use Cases

- [ ] **`GetDashboardUseCase`**
  - Appelle toutes les méthodes de `DashboardQueryService` en parallèle (`Promise.all`)
  - Paramètre : `stockAlertThreshold?: number` (défaut : 5)
  - Retourne `DashboardMetrics`

---

## 4 · Présentation (`/dashboard`)

### DTOs

- [ ] `RevenueStatsDto`
- [ ] `InvoicesSummaryDto`
- [ ] `QuotesPipelineDto`
- [ ] `TopCustomerDto`
- [ ] `RecentOrderDto`
- [ ] `RecentInvoiceDto`
- [ ] `StockAlertDto`
- [ ] `DashboardResponseDto` (compose tous les DTOs ci-dessus)

### Endpoints

- [ ] `GET /dashboard` — `@Roles(Admin, Manager)`
  - Query : `stockAlertThreshold?: number`
  - Retourne `DashboardResponseDto`
  - **Pas de cache pour la démo** (à noter comme amélioration possible)

---

## 5 · Règles métier

| Règle | Détail |
|-------|--------|
| Chiffre d'affaires | Uniquement les factures de type `INVOICE` (pas `CREDIT_NOTE`) en statut `PAID` |
| Top clients | Par CA encaissé (factures PAID uniquement), limité aux 5 premiers |
| Stock alerts | Basé sur le niveau actuel < seuil. Les services (type=SERVICE) sont exclus |
| Requêtes parallèles | Toutes les métriques sont chargées en `Promise.all` pour minimiser la latence |
| Devise | Tous les montants sont en EUR, arrondi à 2 décimales |

---

## 6 · Tests

- [ ] **Unit** : `GetDashboardUseCase` — mock `DashboardQueryService`, vérifie structure de retour
- [ ] **Unit** : `DashboardQueryService.getRevenueStats()` — vérifier la période (mois courant vs précédent)
- [ ] **Unit** : `DashboardQueryService.getStockAlerts()` — seuil correct, services exclus
- [ ] **E2E** : `GET /dashboard` — retourne la structure correcte avec valeurs cohérentes
- [ ] **E2E** : `GET /dashboard?stockAlertThreshold=10` — seuil personnalisé
