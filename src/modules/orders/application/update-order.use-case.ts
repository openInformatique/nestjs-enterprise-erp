import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetContactByIdUseCase } from '../../contact/application/get-contact-by-id.use-case';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type {
  OrderRepositoryPort,
  UpdateOrderData,
} from '../domain/order-repository.port';
import { OrderType } from '../domain/order-type.enum';
import { computeOrderTotals } from '../domain/order-totals';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';
import {
  OrderLineInput,
  ResolveOrderLinesHelper,
} from './resolve-order-lines.helper';

/** Champs modifiables (le TYPE ne change jamais après création). */
export interface UpdateOrderInput {
  contactId?: string;
  notes?: string;
  expectedDeliveryDate?: string;
  lines?: OrderLineInput[];
}

/**
 * Cas d'utilisation : modifier une commande — DRAFT ou CONFIRMED
 * uniquement (dès que la logistique a commencé, plus rien ne bouge).
 */
@Injectable()
export class UpdateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveOrderLinesHelper: ResolveOrderLinesHelper,
  ) {}

  async execute(orderId: string, input: UpdateOrderInput): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isEditable()) {
      throw new BusinessRuleViolationException(
        `Seule une commande en brouillon ou confirmée est modifiable ` +
          `(statut actuel : ${order.status}).`,
      );
    }

    const changes: UpdateOrderData = {};

    if (input.contactId !== undefined) {
      const contact = await this.getContactByIdUseCase.execute(input.contactId);
      const compatible =
        order.type === OrderType.Customer
          ? contact.isCustomer()
          : contact.isSupplier();
      if (!compatible) {
        throw new BusinessRuleViolationException(
          `Le contact « ${contact.companyName} » ne correspond pas au ` +
            `type de la commande (${order.type}).`,
        );
      }
      changes.contactId = input.contactId;
    }

    if (input.notes !== undefined) {
      changes.notes = input.notes;
    }
    if (input.expectedDeliveryDate !== undefined) {
      changes.expectedDeliveryDate = new Date(input.expectedDeliveryDate);
    }

    if (input.lines !== undefined) {
      const lines = await this.resolveOrderLinesHelper.resolve(input.lines);
      const totals = computeOrderTotals(lines);
      changes.lines = lines;
      changes.totalHT = totals.totalHT;
      changes.totalVAT = totals.totalVAT;
      changes.totalTTC = totals.totalTTC;
    }

    return this.orderRepository.update(orderId, changes);
  }
}
