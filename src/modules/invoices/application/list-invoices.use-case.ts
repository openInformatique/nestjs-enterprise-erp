import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type {
  InvoiceRepositoryPort,
  ListInvoicesQuery,
} from '../domain/invoice-repository.port';

/** Cas d'utilisation : lister les factures (pagination + filtres). */
@Injectable()
export class ListInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
  ) {}

  execute(query: ListInvoicesQuery): Promise<PaginatedResult<Invoice>> {
    return this.invoiceRepository.findAll(query);
  }
}
