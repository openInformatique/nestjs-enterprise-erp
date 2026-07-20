import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { StockMovement } from '../domain/stock-movement';
import { STOCK_MOVEMENT_REPOSITORY } from '../domain/stock-movement-repository.port';
import type {
  ListStockMovementsQuery,
  StockMovementRepositoryPort,
} from '../domain/stock-movement-repository.port';

/** Cas d'utilisation : consulter l'historique des mouvements. */
@Injectable()
export class ListStockMovementsUseCase {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY)
    private readonly stockMovementRepository: StockMovementRepositoryPort,
  ) {}

  execute(
    query: ListStockMovementsQuery,
  ): Promise<PaginatedResult<StockMovement>> {
    return this.stockMovementRepository.findAll(query);
  }
}
