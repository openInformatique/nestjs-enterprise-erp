import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { StockMovement } from '../domain/stock-movement';
import {
  ListStockMovementsQuery,
  StockMovementRepositoryPort,
} from '../domain/stock-movement-repository.port';
import { StockMovementEntity } from './entities/stock-movement.entity';
import { StockMovementMapper } from './stock-movement.mapper';

/** Liste blanche de tri de l'historique. */
const MOVEMENT_SORTABLE_COLUMNS: ColumnWhitelist = {
  performedAt: 'movement.performedAt',
  type: 'movement.type',
  quantity: 'movement.quantity',
};

/** Recherche textuelle sur la référence et les notes. */
const MOVEMENT_SEARCHABLE_COLUMNS = [
  'movement.reference',
  'movement.notes',
] as const;

/** Implémentation TypeORM de la lecture de l'historique des mouvements. */
@Injectable()
export class TypeOrmStockMovementRepository implements StockMovementRepositoryPort {
  constructor(
    @InjectRepository(StockMovementEntity)
    private readonly repository: Repository<StockMovementEntity>,
    private readonly mapper: StockMovementMapper,
  ) {}

  async findAll(
    query: ListStockMovementsQuery,
  ): Promise<PaginatedResult<StockMovement>> {
    const queryBuilder = this.repository.createQueryBuilder('movement');

    if (query.productId !== undefined) {
      queryBuilder.andWhere('movement.productId = :productId', {
        productId: query.productId,
      });
    }
    if (query.warehouseId !== undefined) {
      queryBuilder.andWhere('movement.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.type !== undefined) {
      queryBuilder.andWhere('movement.type = :type', { type: query.type });
    }
    if (query.from !== undefined) {
      queryBuilder.andWhere('movement.performedAt >= :from', {
        from: query.from,
      });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('movement.performedAt <= :to', { to: query.to });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      MOVEMENT_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      // Historique : les mouvements les plus récents d'abord.
      queryBuilder.orderBy('movement.performedAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        MOVEMENT_SORTABLE_COLUMNS,
      );
    }

    const result = await TypeOrmPaginationHelper.paginate(
      queryBuilder,
      query.page,
      query.limit,
    );

    return {
      items: result.items.map((entity) => this.mapper.toDomain(entity)),
      meta: result.meta,
    };
  }
}
