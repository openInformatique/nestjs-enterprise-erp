import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginatedResult } from './paginated-result';
import { PaginationMetaDto } from './pagination-meta.dto';

/**
 * Helper de pagination TypeORM.
 *
 * Applique skip/take sur un QueryBuilder existant et construit le
 * résultat paginé standard. Le QueryBuilder reste entièrement visible
 * pour le module appelant : le helper ne masque pas TypeORM.
 *
 * Exemple :
 *
 *   const qb = repository.createQueryBuilder('user');
 *   TypeOrmFilterHelper.applySort(qb, query, USER_SORTABLE_COLUMNS);
 *   const result = await TypeOrmPaginationHelper.paginate(qb, query.page, query.limit);
 */
export class TypeOrmPaginationHelper {
  static async paginate<TEntity extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<TEntity>,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<TEntity>> {
    const [items, totalItems] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: PaginationMetaDto.fromTotals(page, limit, totalItems),
    };
  }
}
