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
