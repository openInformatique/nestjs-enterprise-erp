import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';
import { SortDirection } from './sort-direction.enum';

/** Simule la transformation + validation opérée par le ValidationPipe. */
const buildAndValidate = (
  query: Record<string, string>,
): { dto: PaginationQueryDto; errors: string[] } => {
  const dto = plainToInstance(PaginationQueryDto, query);
  const errors = validateSync(dto).map((error) => error.property);
  return { dto, errors };
};

describe('PaginationQueryDto', () => {
  it('applique les valeurs par défaut', () => {
    const { dto, errors } = buildAndValidate({});

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sortDirection).toBe(SortDirection.Asc);
    expect(dto.offset).toBe(0);
  });

  it('convertit les paramètres de chaîne en nombres', () => {
    const { dto, errors } = buildAndValidate({ page: '3', limit: '50' });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
    expect(dto.offset).toBe(100);
  });

  it('rejette une page nulle ou négative', () => {
    expect(buildAndValidate({ page: '0' }).errors).toContain('page');
    expect(buildAndValidate({ page: '-2' }).errors).toContain('page');
  });

  it('rejette une limite au-delà du maximum (100)', () => {
    expect(buildAndValidate({ limit: '101' }).errors).toContain('limit');
  });

  it('rejette une valeur non entière', () => {
    expect(buildAndValidate({ page: 'abc' }).errors).toContain('page');
    expect(buildAndValidate({ limit: '2.5' }).errors).toContain('limit');
  });

  it('rejette une direction de tri inconnue', () => {
    expect(buildAndValidate({ sortDirection: 'RANDOM' }).errors).toContain(
      'sortDirection',
    );
  });
});
