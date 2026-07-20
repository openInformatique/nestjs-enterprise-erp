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
