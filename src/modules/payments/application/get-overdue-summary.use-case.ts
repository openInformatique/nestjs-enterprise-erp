import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { GetContactByIdUseCase } from '../../contact/application/get-contact-by-id.use-case';
import { Invoice } from '../../invoices/domain/invoice';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { Payment } from '../domain/payment';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';

/** Une ligne du résumé : la facture, son client, son retard, ses paiements. */
export interface OverdueInvoiceSummary {
  invoice: Invoice;
  /** E-mail du client — la donnée qui manque au domaine Invoice
   *  (customerName seul), indispensable pour relancer. */
  customerEmail: string | null;
  /** Jours de retard, entiers ; 0 si l'échéance n'est pas dépassée
   *  (cas PARTIALLY_PAID encore dans les temps). */
  daysOverdue: number;
  /** Encaissements déjà reçus, par date de valeur croissante. */
  payments: Payment[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Cas d'utilisation : le résumé des impayés — les factures OVERDUE et
 * PARTIALLY_PAID, triées par reste à payer décroissant (les plus gros
 * trous de trésorerie d'abord), avec de quoi relancer : le client
 * (nom + e-mail), le retard en jours, l'historique des encaissements.
 *
 * Croise TROIS modules (factures, contacts, paiements) : c'est un
 * agrégat de LECTURE — aucune écriture, aucune règle d'état.
 */
@Injectable()
export class GetOverdueSummaryUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
  ) {}

  async execute(query: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<OverdueInvoiceSummary>> {
    const result = await this.invoiceRepository.findUnpaid(query);
    const now = new Date();

    const items: OverdueInvoiceSummary[] = [];
    for (const invoice of result.items) {
      const contact = await this.getContactByIdUseCase.execute(
        invoice.customerId,
      );
      const payments = await this.paymentRepository.findByInvoice(invoice.id);

      items.push({
        invoice,
        customerEmail: contact.email,
        daysOverdue: Math.max(
          0,
          Math.floor((now.getTime() - invoice.dueDate.getTime()) / MS_PER_DAY),
        ),
        payments,
      });
    }

    return { items, meta: result.meta };
  }
}
