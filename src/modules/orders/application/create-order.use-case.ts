import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetContactByIdUseCase } from '../../contact/application/get-contact-by-id.use-case';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';
import { computeOrderTotals } from '../domain/order-totals';
import {
  OrderLineInput,
  ResolveOrderLinesHelper,
} from './resolve-order-lines.helper';

/** Données de création (déjà validées par le DTO). */
export interface CreateOrderInput {
  type: OrderType;
  contactId: string;
  notes?: string;
  expectedDeliveryDate?: string;
  lines: OrderLineInput[];
  /** Réservé à la conversion de devis (jamais exposé dans le DTO). */
  quoteId?: string;
}

/**
 * Cas d'utilisation : créer une commande (statut DRAFT).
 *
 * Règle centrale : la COHÉRENCE contact/type — une commande CUSTOMER
 * exige un contact client, une commande SUPPLIER un fournisseur
 * (BOTH passe partout, c'est sa raison d'être).
 */
@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveOrderLinesHelper: ResolveOrderLinesHelper,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateOrderInput,
  ): Promise<Order> {
    const contact = await this.getContactByIdUseCase.execute(input.contactId);

    if (input.type === OrderType.Customer && !contact.isCustomer()) {
      throw new BusinessRuleViolationException(
        `Le contact « ${contact.companyName} » n'est pas un client : ` +
          'impossible de créer une commande client pour lui.',
      );
    }
    if (input.type === OrderType.Supplier && !contact.isSupplier()) {
      throw new BusinessRuleViolationException(
        `Le contact « ${contact.companyName} » n'est pas un fournisseur : ` +
          'impossible de lui passer une commande.',
      );
    }

    const lines = await this.resolveOrderLinesHelper.resolve(input.lines);
    const totals = computeOrderTotals(lines);

    return this.orderRepository.create({
      number: await this.orderRepository.nextNumber(input.type),
      type: input.type,
      contactId: input.contactId,
      status: OrderStatus.Draft,
      quoteId: input.quoteId ?? null,
      notes: input.notes ?? null,
      ...totals,
      expectedDeliveryDate: input.expectedDeliveryDate
        ? new Date(input.expectedDeliveryDate)
        : null,
      createdBy: actor.userId,
      lines,
    });
  }
}
