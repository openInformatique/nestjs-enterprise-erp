import { BadRequestException } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { FilterOperator } from './filter-operator.enum';
import { SortDirection } from './sort-direction.enum';
import { TypeOrmFilterHelper } from './typeorm-filter.helper';

/**
 * Double de test du SelectQueryBuilder : enregistre les appels sans
 * nécessiter de connexion à la base.
 */
interface QueryBuilderSpy {
  andWhereCalls: Array<{
    clause: string;
    parameters?: Record<string, unknown>;
  }>;
  orderByCalls: Array<{ column: string; direction: string }>;
  builder: SelectQueryBuilder<ObjectLiteral>;
}

const createQueryBuilderSpy = (): QueryBuilderSpy => {
  const spy: QueryBuilderSpy = {
    andWhereCalls: [],
    orderByCalls: [],
    // Objet minimal se faisant passer pour un SelectQueryBuilder ; seuls
    // andWhere et orderBy sont utilisés par les helpers testés.
    builder: undefined as unknown as SelectQueryBuilder<ObjectLiteral>,
  };
  const builder = {
    andWhere(clause: string, parameters?: Record<string, unknown>) {
      spy.andWhereCalls.push({ clause, parameters });
      return builder;
    },
    orderBy(column: string, direction: string) {
      spy.orderByCalls.push({ column, direction });
      return builder;
    },
  };
  spy.builder = builder as unknown as SelectQueryBuilder<ObjectLiteral>;
  return spy;
};

const WHITELIST = {
  email: 'user.email',
  createdAt: 'user.created_at',
} as const;

describe('TypeOrmFilterHelper.applySort', () => {
  it('applique un tri autorisé avec la colonne de la liste blanche', () => {
    const spy = createQueryBuilderSpy();

    TypeOrmFilterHelper.applySort(
      spy.builder,
      'email',
      SortDirection.Desc,
      WHITELIST,
    );

    expect(spy.orderByCalls).toEqual([
      { column: 'user.email', direction: 'DESC' },
    ]);
  });

  it('ne fait rien sans sortBy', () => {
    const spy = createQueryBuilderSpy();

    TypeOrmFilterHelper.applySort(
      spy.builder,
      undefined,
      SortDirection.Asc,
      WHITELIST,
    );

    expect(spy.orderByCalls).toHaveLength(0);
  });

  it('rejette une colonne hors liste blanche avec une erreur 400', () => {
    const spy = createQueryBuilderSpy();

    expect(() =>
      TypeOrmFilterHelper.applySort(
        spy.builder,
        'password_hash',
        SortDirection.Asc,
        WHITELIST,
      ),
    ).toThrow(BadRequestException);
    expect(spy.orderByCalls).toHaveLength(0);
  });
});

describe('TypeOrmFilterHelper.applyFilters', () => {
  it('traduit un filtre "eq" en clause paramétrée', () => {
    const spy = createQueryBuilderSpy();

    TypeOrmFilterHelper.applyFilters(
      spy.builder,
      [
        {
          field: 'email',
          operator: FilterOperator.Equals,
          value: 'a@b.fr',
        },
      ],
      WHITELIST,
    );

    expect(spy.andWhereCalls).toHaveLength(1);
    const call = spy.andWhereCalls[0]!;
    expect(call.clause).toMatch(/^user\.email = :filter_\d+$/);
    expect(Object.values(call.parameters!)).toEqual(['a@b.fr']);
  });

  it('rejette un champ hors liste blanche', () => {
    const spy = createQueryBuilderSpy();

    expect(() =>
      TypeOrmFilterHelper.applyFilters(
        spy.builder,
        [{ field: 'is_admin', operator: FilterOperator.Equals, value: true }],
        WHITELIST,
      ),
    ).toThrow(BadRequestException);
  });

  it('échappe les jokers LIKE pour "contains"', () => {
    const spy = createQueryBuilderSpy();

    TypeOrmFilterHelper.applyFilters(
      spy.builder,
      [
        {
          field: 'email',
          operator: FilterOperator.Contains,
          value: '50%_[test]',
        },
      ],
      WHITELIST,
    );

    const parameters = Object.values(spy.andWhereCalls[0]!.parameters!);
    expect(parameters).toEqual(['%50[%][_][[]test]%']);
  });

  it('rejette un "in" sans liste de valeurs', () => {
    const spy = createQueryBuilderSpy();

    expect(() =>
      TypeOrmFilterHelper.applyFilters(
        spy.builder,
        [{ field: 'email', operator: FilterOperator.In, value: [] }],
        WHITELIST,
      ),
    ).toThrow(BadRequestException);
  });

  it('gère "isnull" sans paramètre', () => {
    const spy = createQueryBuilderSpy();

    TypeOrmFilterHelper.applyFilters(
      spy.builder,
      [{ field: 'createdAt', operator: FilterOperator.IsNull }],
      WHITELIST,
    );

    expect(spy.andWhereCalls[0]!.clause).toBe('user.created_at IS NULL');
    expect(spy.andWhereCalls[0]!.parameters).toBeUndefined();
  });
});

describe('TypeOrmFilterHelper.applySearch', () => {
  it('construit une clause OR sur les colonnes de recherche', () => {
    const spy = createQueryBuilderSpy();

    TypeOrmFilterHelper.applySearch(spy.builder, 'dupont', [
      'user.email',
      'user.display_name',
    ]);

    expect(spy.andWhereCalls).toHaveLength(1);
    const call = spy.andWhereCalls[0]!;
    expect(call.clause).toMatch(
      /^\(user\.email LIKE :filter_\d+ OR user\.display_name LIKE :filter_\d+\)$/,
    );
    expect(Object.values(call.parameters!)).toEqual(['%dupont%']);
  });

  it('ignore une recherche vide', () => {
    const spy = createQueryBuilderSpy();

    TypeOrmFilterHelper.applySearch(spy.builder, '   ', ['user.email']);

    expect(spy.andWhereCalls).toHaveLength(0);
  });

  it('neutralise les jokers de la valeur recherchée', () => {
    const spy = createQueryBuilderSpy();

    TypeOrmFilterHelper.applySearch(spy.builder, '100%', ['user.email']);

    expect(Object.values(spy.andWhereCalls[0]!.parameters!)).toEqual([
      '%100[%]%',
    ]);
  });
});
