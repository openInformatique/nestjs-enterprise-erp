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
