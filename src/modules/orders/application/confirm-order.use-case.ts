import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/** Cas d'utilisation : confirmer une commande (DRAFT -> CONFIRMED). */
@Injectable()
export class ConfirmOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
  ) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une commande en brouillon peut être confirmée (statut ` +
          `actuel : ${order.status}).`,
      );
    }

    return this.orderRepository.update(orderId, {
      status: OrderStatus.Confirmed,
    });
  }
}
