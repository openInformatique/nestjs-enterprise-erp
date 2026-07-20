import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type {
  ListOrdersQuery,
  OrderRepositoryPort,
} from '../domain/order-repository.port';

/** Cas d'utilisation : lister les commandes (pagination + filtres). */
@Injectable()
export class ListOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  execute(query: ListOrdersQuery): Promise<PaginatedResult<Order>> {
    return this.orderRepository.findAll(query);
  }
}
