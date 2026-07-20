import { BadRequestException } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { FilterOperator } from './filter-operator.enum';
import { SortDirection } from './sort-direction.enum';

/**
 * Filtre applicatif : champ exposé + opérateur + valeur.
 * Le champ est un nom LOGIQUE (clé de la liste blanche), jamais un nom
 * de colonne SQL brut fourni par le consommateur.
 */
export interface FieldFilter {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

/**
 * Liste blanche : associe un nom de champ exposé par l'API à l'expression
 * de colonne TypeORM correspondante (ex. : 'email' -> 'user.email').
 *
 * C'est la SEULE source des noms de colonnes utilisés dans les requêtes :
 * une entrée utilisateur ne parvient jamais telle quelle dans le SQL.
 */
export type ColumnWhitelist = Readonly<Record<string, string>>;

/** Compteur interne garantissant l'unicité des noms de paramètres SQL. */
let parameterSequence = 0;
const nextParameterName = (): string => `filter_${(parameterSequence += 1)}`;

/**
 * Helpers de tri, filtres et recherche pour TypeORM.
 *
 * Toutes les valeurs passent par des paramètres nommés TypeORM
 * (aucune concaténation), et tous les noms de colonnes proviennent
 * des listes blanches fournies par le module appelant.
 */
export class TypeOrmFilterHelper {
  /**
   * Applique un tri si `sortBy` est présent ET autorisé.
   *
   * Une colonne hors liste blanche est rejetée avec une erreur 400
   * explicite plutôt qu'ignorée silencieusement.
   */
  static applySort<TEntity extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<TEntity>,
    sortBy: string | undefined,
    sortDirection: SortDirection,
    whitelist: ColumnWhitelist,
  ): SelectQueryBuilder<TEntity> {
    if (sortBy === undefined) {
      return queryBuilder;
    }

    const column = whitelist[sortBy];
    if (column === undefined) {
      throw new BadRequestException(
        `Le tri sur "${sortBy}" n'est pas autorisé. Colonnes autorisées : ` +
          `${Object.keys(whitelist).join(', ')}.`,
      );
    }

    return queryBuilder.orderBy(column, sortDirection);
  }

  /**
   * Applique une liste de filtres, chacun validé contre la liste blanche.
   */
  static applyFilters<TEntity extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<TEntity>,
    filters: FieldFilter[],
    whitelist: ColumnWhitelist,
  ): SelectQueryBuilder<TEntity> {
    for (const filter of filters) {
      const column = whitelist[filter.field];
      if (column === undefined) {
        throw new BadRequestException(
          `Le filtre sur "${filter.field}" n'est pas autorisé. Champs ` +
            `autorisés : ${Object.keys(whitelist).join(', ')}.`,
        );
      }
      this.applySingleFilter(queryBuilder, column, filter);
    }
    return queryBuilder;
  }

  /**
   * Applique une recherche textuelle insensible à la casse sur les
   * colonnes désignées par le module (jamais par le consommateur).
   * Les jokers LIKE de la valeur recherchée sont neutralisés.
   */
  static applySearch<TEntity extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<TEntity>,
    search: string | undefined,
    searchableColumns: readonly string[],
  ): SelectQueryBuilder<TEntity> {
    if (search === undefined || search.trim() === '') {
      return queryBuilder;
    }
    if (searchableColumns.length === 0) {
      return queryBuilder;
    }

    const parameter = nextParameterName();
    const escaped = this.escapeLikeValue(search.trim());
    const clause = searchableColumns
      .map((column) => `${column} LIKE :${parameter}`)
      .join(' OR ');

    return queryBuilder.andWhere(`(${clause})`, {
      [parameter]: `%${escaped}%`,
    });
  }

  /** Échappe les jokers SQL Server d'une valeur destinée à LIKE. */
  static escapeLikeValue(value: string): string {
    return value
      .replace(/\[/g, '[[]')
      .replace(/%/g, '[%]')
      .replace(/_/g, '[_]');
  }

  private static applySingleFilter<TEntity extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<TEntity>,
    column: string,
    filter: FieldFilter,
  ): void {
    const parameter = nextParameterName();

    switch (filter.operator) {
      case FilterOperator.Equals:
        queryBuilder.andWhere(`${column} = :${parameter}`, {
          [parameter]: filter.value,
        });
        break;
      case FilterOperator.NotEquals:
        queryBuilder.andWhere(`${column} <> :${parameter}`, {
          [parameter]: filter.value,
        });
        break;
      case FilterOperator.GreaterThan:
        queryBuilder.andWhere(`${column} > :${parameter}`, {
          [parameter]: filter.value,
        });
        break;
      case FilterOperator.GreaterThanOrEqual:
        queryBuilder.andWhere(`${column} >= :${parameter}`, {
          [parameter]: filter.value,
        });
        break;
      case FilterOperator.LessThan:
        queryBuilder.andWhere(`${column} < :${parameter}`, {
          [parameter]: filter.value,
        });
        break;
      case FilterOperator.LessThanOrEqual:
        queryBuilder.andWhere(`${column} <= :${parameter}`, {
          [parameter]: filter.value,
        });
        break;
      case FilterOperator.Contains:
        queryBuilder.andWhere(`${column} LIKE :${parameter}`, {
          [parameter]: `%${this.escapeLikeValue(String(filter.value))}%`,
        });
        break;
      case FilterOperator.In:
        if (!Array.isArray(filter.value) || filter.value.length === 0) {
          throw new BadRequestException(
            `L'opérateur "in" requiert une liste de valeurs non vide.`,
          );
        }
        queryBuilder.andWhere(`${column} IN (:...${parameter})`, {
          [parameter]: filter.value,
        });
        break;
      case FilterOperator.IsNull:
        queryBuilder.andWhere(`${column} IS NULL`);
        break;
      case FilterOperator.IsNotNull:
        queryBuilder.andWhere(`${column} IS NOT NULL`);
        break;
    }
  }
}
