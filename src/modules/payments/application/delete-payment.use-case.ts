import { Inject, Injectable } from '@nestjs/common';
import { GetInvoiceByIdUseCase } from '../../invoices/application/get-invoice-by-id.use-case';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { InvoiceStatus } from '../../invoices/domain/invoice-status.enum';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';
import { GetPaymentByIdUseCase } from './get-payment-by-id.use-case';

/**
 * Cas d'utilisation : supprimer un paiement (saisie erronée) — réservé
 * ADMIN (contrôleur).
 *
 * Après suppression, TOUT est recalculé, comme à l'enregistrement :
 *   - paidAmount = SUM(payments) restants ;
 *   - statut recorrigé : PAID si (encore) soldée, sinon OVERDUE si
 *     l'échéance est dépassée (le cron du 07 l'aurait reposé cette
 *     nuit — autant être juste tout de suite), sinon PARTIALLY_PAID
 *     s'il reste des encaissements, sinon retour à SENT.
 */
@Injectable()
export class DeletePaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getPaymentByIdUseCase: GetPaymentByIdUseCase,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(paymentId: string): Promise<void> {
    const payment = await this.getPaymentByIdUseCase.execute(paymentId);
    const invoice = await this.getInvoiceByIdUseCase.execute(payment.invoiceId);

    await this.paymentRepository.delete(paymentId);

    const paidAmount = await this.paymentRepository.sumByInvoice(invoice.id);

    let status: InvoiceStatus;
    if (paidAmount >= invoice.totalTTC) {
      status = InvoiceStatus.Paid;
    } else if (invoice.dueDate < new Date()) {
      status = InvoiceStatus.Overdue;
    } else if (paidAmount > 0) {
      status = InvoiceStatus.PartiallyPaid;
    } else {
      status = InvoiceStatus.Sent;
    }

    await this.invoiceRepository.update(invoice.id, { paidAmount, status });
  }
}
