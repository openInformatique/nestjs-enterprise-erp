import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { GetInvoiceByIdUseCase } from '../../invoices/application/get-invoice-by-id.use-case';
import { Invoice } from '../../invoices/domain/invoice';
import { PaymentMethod } from '../domain/payment-method.enum';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';

/** Filtres d'export. */
export interface ExportPaymentsFilters {
  invoiceId?: string;
  method?: PaymentMethod;
  from?: Date;
  to?: Date;
}

const HEADERS = [
  'Facture',
  'Client',
  'Montant',
  'Méthode',
  'Référence',
  'Date de valeur',
  'Saisi par',
];

/**
 * Cas d'utilisation : exporter les paiements (CSV/XLSX).
 * Facture et client sont RÉSOLUS PAR FACTURE DISTINCTE (pas par ligne) :
 * un export de 10 000 paiements ne porte, en pratique, que sur quelques
 * centaines de factures — un Map évite les répétitions inutiles.
 */
@Injectable()
export class ExportPaymentsUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(
    filters: ExportPaymentsFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const result = await this.paymentRepository.findAll({
      page: 1,
      limit: EXPORT_MAX_ROWS + 1,
      sortDirection: SortDirection.Asc,
      invoiceId: filters.invoiceId,
      method: filters.method,
      from: filters.from,
      to: filters.to,
    });

    if (result.meta.totalItems > EXPORT_MAX_ROWS) {
      throw new ExportTooLargeException(
        result.meta.totalItems,
        EXPORT_MAX_ROWS,
      );
    }

    const invoicesById = new Map<string, Invoice>();
    for (const payment of result.items) {
      if (!invoicesById.has(payment.invoiceId)) {
        invoicesById.set(
          payment.invoiceId,
          await this.getInvoiceByIdUseCase.execute(payment.invoiceId),
        );
      }
    }

    const rows = result.items.map((payment) => {
      const invoice = invoicesById.get(payment.invoiceId) as Invoice;
      return [
        invoice.number,
        invoice.customerName,
        payment.amount,
        payment.method,
        payment.reference ?? '',
        payment.paidAt,
        payment.recordedBy,
      ];
    });

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Paiements', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
