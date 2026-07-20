import { Inject, Injectable } from '@nestjs/common';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';

/**
 * Cas d'utilisation : marquer OVERDUE les factures à échéance dépassée
 * (SENT et PARTIALLY_PAID). Appelé par la tâche planifiée. Idempotent.
 */
@Injectable()
export class CheckOverdueInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
  ) {}

  /** Renvoie le nombre de factures passées en retard. */
  async execute(): Promise<number> {
    const overdue = await this.invoiceRepository.findOverdue(new Date());

    for (const invoice of overdue) {
      await this.invoiceRepository.update(invoice.id, {
        status: InvoiceStatus.Overdue,
      });
    }

    return overdue.length;
  }
}
