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
import { StockLevel, StockLevelView } from '../domain/stock-level';
import {
  ListStockLevelsQuery,
  LOW_STOCK_THRESHOLD,
  StockLevelRepositoryPort,
} from '../domain/stock-level-repository.port';
import { StockLevelEntity } from './entities/stock-level.entity';
import { StockLevelMapper } from './stock-level.mapper';

/** Liste blanche de tri — inclut des colonnes des tables JOINTES. */
const STOCK_LEVEL_SORTABLE_COLUMNS: ColumnWhitelist = {
  quantity: 'level.quantity',
  productName: 'product.name',
  warehouseName: 'warehouse.name',
  updatedAt: 'level.updatedAt',
};

/** Recherche textuelle : sur le produit joint (SKU et nom). */
const STOCK_LEVEL_SEARCHABLE_COLUMNS = ['product.sku', 'product.name'] as const;

/** Implémentation TypeORM de la lecture des niveaux de stock. */
@Injectable()
export class TypeOrmStockLevelRepository implements StockLevelRepositoryPort {
  constructor(
    @InjectRepository(StockLevelEntity)
    private readonly repository: Repository<StockLevelEntity>,
    private readonly mapper: StockLevelMapper,
  ) {}

  async findAllViews(
    query: ListStockLevelsQuery,
  ): Promise<PaginatedResult<StockLevelView>> {
    // innerJoinAndSelect : charge les relations EN MÊME TEMPS que les
    // niveaux (une seule requête SQL) — indispensable pour toView().
    const queryBuilder = this.repository
      .createQueryBuilder('level')
      .innerJoinAndSelect('level.product', 'product')
      .innerJoinAndSelect('level.warehouse', 'warehouse');

    if (query.productId !== undefined) {
      queryBuilder.andWhere('level.productId = :productId', {
        productId: query.productId,
      });
    }
    if (query.warehouseId !== undefined) {
      queryBuilder.andWhere('level.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.lowStock === true) {
      queryBuilder.andWhere('level.quantity < :threshold', {
        threshold: LOW_STOCK_THRESHOLD,
      });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      STOCK_LEVEL_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('product.name', SortDirection.Asc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        STOCK_LEVEL_SORTABLE_COLUMNS,
      );
    }

    const result = await TypeOrmPaginationHelper.paginate(
      queryBuilder,
      query.page,
      query.limit,
    );

    return {
      items: result.items.map((entity) => this.mapper.toView(entity)),
      meta: result.meta,
    };
  }

  async findOne(
    productId: string,
    warehouseId: string,
  ): Promise<StockLevel | null> {
    const entity = await this.repository.findOne({
      where: { productId, warehouseId },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async sumQuantityForWarehouse(warehouseId: string): Promise<number> {
    const raw = await this.repository
      .createQueryBuilder('level')
      .select('COALESCE(SUM(level.quantity), 0)', 'total')
      .where('level.warehouseId = :warehouseId', { warehouseId })
      .getRawOne<{ total: number | string }>();

    // Les agrégats SQL arrivent parfois en CHAÎNE côté JS : Number().
    return Number(raw?.total ?? 0);
  }
}
