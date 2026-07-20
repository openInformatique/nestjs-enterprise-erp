/**
 * Opérateurs de filtre exposés aux consommateurs de l'API.
 *
 * Chaque opérateur est traduit en SQL paramétré par TypeOrmFilterHelper ;
 * aucune valeur utilisateur n'est jamais concaténée dans la requête.
 */
export enum FilterOperator {
  Equals = 'eq',
  NotEquals = 'neq',
  GreaterThan = 'gt',
  GreaterThanOrEqual = 'gte',
  LessThan = 'lt',
  LessThanOrEqual = 'lte',
  /** LIKE %valeur% (les jokers de la valeur sont échappés). */
  Contains = 'contains',
  In = 'in',
  IsNull = 'isnull',
  IsNotNull = 'isnotnull',
}
