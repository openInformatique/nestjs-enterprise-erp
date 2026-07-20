import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';

/** Filtres d'export. */
export interface ExportOrdersFilters {
  type?: OrderType;
  status?: OrderStatus;
  contactId?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

const HEADERS = [
  'Numéro',
  'Type',
  'Statut',
  'Contact',
  'Total HT',
  'Total TTC',
  'Livraison prévue',
  'Livrée le',
  'Créée le',
];

/** Cas d'utilisation : exporter les commandes (CSV/XLSX), filtres appliqués. */
@Injectable()
export class ExportOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(
    filters: ExportOrdersFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const result = await this.orderRepository.findAll({
      page: 1,
      limit: EXPORT_MAX_ROWS + 1,
      sortDirection: SortDirection.Asc,
      type: filters.type,
      status: filters.status,
      contactId: filters.contactId,
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

    const rows = result.items.map((order) => [
      order.number,
      order.type,
      order.status,
      order.contactName,
      order.totalHT,
      order.totalTTC,
      order.expectedDeliveryDate ?? '',
      order.deliveredAt ?? '',
      order.createdAt,
    ]);

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Commandes', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
