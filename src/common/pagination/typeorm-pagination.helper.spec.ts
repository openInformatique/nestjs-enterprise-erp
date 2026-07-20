import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { TypeOrmPaginationHelper } from './typeorm-pagination.helper';

interface PaginationSpy {
  skipValue?: number;
  takeValue?: number;
  builder: SelectQueryBuilder<ObjectLiteral>;
}

const createPaginationSpy = (
  items: unknown[],
  totalItems: number,
): PaginationSpy => {
  const spy: PaginationSpy = {
    builder: undefined as unknown as SelectQueryBuilder<ObjectLiteral>,
  };
  const builder = {
    skip(value: number) {
      spy.skipValue = value;
      return builder;
    },
    take(value: number) {
      spy.takeValue = value;
      return builder;
    },
    getManyAndCount() {
      return Promise.resolve([items, totalItems]);
    },
  };
  spy.builder = builder as unknown as SelectQueryBuilder<ObjectLiteral>;
  return spy;
};

describe('TypeOrmPaginationHelper', () => {
  it('applique skip/take et construit le résultat paginé', async () => {
    const rows = [{ id: '1' }, { id: '2' }];
    const spy = createPaginationSpy(rows, 42);

    const result = await TypeOrmPaginationHelper.paginate(spy.builder, 3, 10);

    expect(spy.skipValue).toBe(20);
    expect(spy.takeValue).toBe(10);
    expect(result.items).toEqual(rows);
    expect(result.meta.page).toBe(3);
    expect(result.meta.totalItems).toBe(42);
    expect(result.meta.totalPages).toBe(5);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.hasPreviousPage).toBe(true);
  });

  it('gère une première page vide', async () => {
    const spy = createPaginationSpy([], 0);

    const result = await TypeOrmPaginationHelper.paginate(spy.builder, 1, 20);

    expect(result.items).toEqual([]);
    expect(result.meta.totalPages).toBe(0);
    expect(result.meta.hasNextPage).toBe(false);
  });
});
