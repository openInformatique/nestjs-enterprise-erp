import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { roundMoney } from '../../../common/money/money';
import { CreateOrderUseCase } from '../../orders/application/create-order.use-case';
import { Order } from '../../orders/domain/order';
import { ORDER_REPOSITORY } from '../../orders/domain/order-repository.port';
import type { OrderRepositoryPort } from '../../orders/domain/order-repository.port';
import { OrderType } from '../../orders/domain/order-type.enum';
import { QuoteStatus } from '../domain/quote-status.enum';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';

/**
 * Cas d'utilisation : convertir un devis ACCEPTÉ en commande client.
 *
 * Règles :
 *   - le devis doit être ACCEPTED (409 sinon) ;
 *   - un devis ne se convertit qu'UNE fois (la commande porte quoteId) ;
 *   - les lignes sont copiées avec la remise FONDUE dans le prix
 *     unitaire (une ligne de commande n'a pas de colonne remise) —
 *     prix ligne = prix devis × (1 - remise/100), au centime ;
 *   - le devis RESTE en statut ACCEPTED (il n'a pas de statut
 *     « converti » : c'est la commande qui trace le lien).
 */
@Injectable()
export class ConvertQuoteToOrderUseCase {
  constructor(
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly createOrderUseCase: CreateOrderUseCase,
  ) {}

  async execute(actor: AuthenticatedUser, quoteId: string): Promise<Order> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);

    if (quote.status !== QuoteStatus.Accepted) {
      throw new BusinessRuleViolationException(
        `Seul un devis accepté peut être converti en commande (statut ` +
          `actuel : ${quote.status}).`,
      );
    }

    if (await this.orderRepository.existsForQuote(quoteId)) {
      throw new BusinessRuleViolationException(
        `Le devis ${quote.number} a déjà été converti en commande.`,
      );
    }

    return this.createOrderUseCase.execute(actor, {
      type: OrderType.Customer,
      contactId: quote.customerId,
      notes: quote.notes ?? undefined,
      quoteId: quote.id,
      lines: quote.lines.map((line) => ({
        productId: line.productId ?? undefined,
        description: line.description,
        quantity: line.quantity,
        // Remise fondue dans le prix : les totaux de la commande
        // peuvent différer du devis d'un centime dans de rares cas
        // d'arrondi — c'est le prix FONDU qui fait foi.
        unitPrice: roundMoney(
          line.unitPrice * (1 - line.discountPercent / 100),
        ),
        vatRate: line.vatRate,
      })),
    });
  }
}
