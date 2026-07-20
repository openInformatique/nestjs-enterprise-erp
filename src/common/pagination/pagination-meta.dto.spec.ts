import { PaginationMetaDto } from './pagination-meta.dto';

describe('PaginationMetaDto', () => {
  it('calcule les totaux pour une liste standard', () => {
    const meta = PaginationMetaDto.fromTotals(1, 20, 48);

    expect(meta.page).toBe(1);
    expect(meta.limit).toBe(20);
    expect(meta.totalItems).toBe(48);
    expect(meta.totalPages).toBe(3);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPreviousPage).toBe(false);
  });

  it('gère la dernière page', () => {
    const meta = PaginationMetaDto.fromTotals(3, 20, 48);

    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(true);
  });

  it('gère une liste vide', () => {
    const meta = PaginationMetaDto.fromTotals(1, 20, 0);

    expect(meta.totalItems).toBe(0);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(false);
  });

  it('gère un total exactement divisible par la limite', () => {
    const meta = PaginationMetaDto.fromTotals(2, 20, 40);

    expect(meta.totalPages).toBe(2);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(true);
  });
});
