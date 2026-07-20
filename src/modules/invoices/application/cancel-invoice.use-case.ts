import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';

/**
 * Cas d'utilisation : annuler une facture — DRAFT ou SENT uniquement.
 * Dès qu'un centime a été encaissé (PARTIALLY_PAID, PAID), l'annulation
 * est interdite : la correction comptable est l'AVOIR.
 */
@Injectable()
export class CancelInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(invoiceId: string): Promise<Invoice> {
    const invoice = await this.getInvoiceByIdUseCase.execute(invoiceId);
    if (!invoice.isCancellable()) {
      throw new BusinessRuleViolationException(
        `Cette facture (statut ${invoice.status}) ne peut plus être ` +
          'annulée : créez un avoir (POST /invoices/:id/credit-note).',
      );
    }

    return this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.Cancelled,
    });
  }
}
