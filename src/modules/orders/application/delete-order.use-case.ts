import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/**
 * Cas d'utilisation : supprimer une commande — BROUILLON UNIQUEMENT
 * (même philosophie qu'au module 05 : au-delà, on ANNULE, on ne
 * supprime pas — l'historique doit rester).
 */
@Injectable()
export class DeleteOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
  ) {}

  async execute(orderId: string): Promise<void> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une commande en brouillon peut être supprimée (statut ` +
          `actuel : ${order.status}). Utilisez l'annulation.`,
      );
    }

    await this.orderRepository.delete(orderId);
  }
}
