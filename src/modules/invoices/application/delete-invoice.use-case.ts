import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';

/**
 * Cas d'utilisation : supprimer une facture — BROUILLON UNIQUEMENT.
 * Une facture émise ne disparaît JAMAIS : c'est une pièce comptable.
 */
@Injectable()
export class DeleteInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoiceByIdUseCase.execute(invoiceId);
    if (!invoice.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une facture en brouillon peut être supprimée (statut ` +
          `actuel : ${invoice.status}).`,
      );
    }

    await this.invoiceRepository.delete(invoiceId);
  }
}
