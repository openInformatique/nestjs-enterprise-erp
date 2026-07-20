import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { StockLevelView } from '../domain/stock-level';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type {
  ListStockLevelsQuery,
  StockLevelRepositoryPort,
} from '../domain/stock-level-repository.port';

/** Cas d'utilisation : consulter les niveaux de stock (vue enrichie). */
@Injectable()
export class GetStockLevelsUseCase {
  constructor(
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
  ) {}

  execute(
    query: ListStockLevelsQuery,
  ): Promise<PaginatedResult<StockLevelView>> {
    return this.stockLevelRepository.findAllViews(query);
  }
}
