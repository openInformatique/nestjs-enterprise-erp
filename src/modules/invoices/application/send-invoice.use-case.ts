import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';

/**
 * Cas d'utilisation : émettre une facture (DRAFT -> SENT).
 *
 * LE POINT DE NON-RETOUR : après cet appel, la facture ne sera plus
 * jamais modifiée ni supprimée. Version minimale : transition seule —
 * le PDF (généré, stocké, pdfUrl) et l'e-mail au client arrivent au
 * niveau min- sans changer cette transition.
 */
@Injectable()
export class SendInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(invoiceId: string): Promise<Invoice> {
    const invoice = await this.getInvoiceByIdUseCase.execute(invoiceId);
    if (!invoice.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une facture en brouillon peut être émise (statut actuel : ` +
          `${invoice.status}).`,
      );
    }

    return this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.Sent,
    });
  }
}
