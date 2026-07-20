import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { InvoiceType } from '../domain/invoice-type.enum';

/** Filtres d'export. */
export interface ExportInvoicesFilters {
  type?: InvoiceType;
  status?: InvoiceStatus;
  customerId?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

const HEADERS = [
  'Numéro',
  'Type',
  'Statut',
  'Client',
  "Date d'émission",
  "Date d'échéance",
  'Total HT',
  'Total TTC',
  'Payé',
  'Reste à payer',
];

/** Cas d'utilisation : exporter factures et avoirs (CSV/XLSX). */
@Injectable()
export class ExportInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
  ) {}

  async execute(
    filters: ExportInvoicesFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const result = await this.invoiceRepository.findAll({
      page: 1,
      limit: EXPORT_MAX_ROWS + 1,
      sortDirection: SortDirection.Asc,
      type: filters.type,
      status: filters.status,
      customerId: filters.customerId,
      search: filters.search,
      from: filters.from,
      to: filters.to,
    });

    if (result.meta.totalItems > EXPORT_MAX_ROWS) {
      throw new ExportTooLargeException(
        result.meta.totalItems,
        EXPORT_MAX_ROWS,
      );
    }

    const rows = result.items.map((invoice) => [
      invoice.number,
      invoice.type,
      invoice.status,
      invoice.customerName,
      invoice.issueDate,
      invoice.dueDate,
      invoice.totalHT,
      invoice.totalTTC,
      invoice.paidAmount,
      invoice.remainingAmount(),
    ]);

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Factures', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
