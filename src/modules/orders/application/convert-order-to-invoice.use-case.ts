import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { CreateInvoiceUseCase } from '../../invoices/application/create-invoice.use-case';
import { Invoice } from '../../invoices/domain/invoice';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/**
 * Cas d'utilisation : facturer une commande client LIVRÉE.
 *
 * Règles :
 *   - commande CUSTOMER uniquement (on ne facture pas ses fournisseurs,
 *     ce sont eux qui nous facturent) ;
 *   - statut DELIVERED uniquement (on facture ce qui a été livré) ;
 *   - une commande ne se facture qu'UNE fois (la facture porte orderId) ;
 *   - lignes copiées TELLES QUELLES (prix figés de la commande).
 */
@Injectable()
export class ConvertOrderToInvoiceUseCase {
  constructor(
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
  ) {}

  async execute(actor: AuthenticatedUser, orderId: string): Promise<Invoice> {
    const order = await this.getOrderByIdUseCase.execute(orderId);

    if (order.type !== OrderType.Customer) {
      throw new BusinessRuleViolationException(
        'Seule une commande CLIENT peut être facturée.',
      );
    }
    if (order.status !== OrderStatus.Delivered) {
      throw new BusinessRuleViolationException(
        `Seule une commande livrée peut être facturée (statut actuel : ` +
          `${order.status}).`,
      );
    }
    if (await this.invoiceRepository.existsForOrder(orderId)) {
      throw new BusinessRuleViolationException(
        `La commande ${order.number} a déjà été facturée.`,
      );
    }

    return this.createInvoiceUseCase.execute(actor, {
      customerId: order.contactId,
      notes: `Facture de la commande ${order.number}.`,
      orderId: order.id,
      lines: order.lines.map((line) => ({
        productId: line.productId ?? undefined,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate,
      })),
    });
  }
}
