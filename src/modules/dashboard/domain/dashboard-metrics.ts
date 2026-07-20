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
