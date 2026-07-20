/**
 * Constantes du module base de données.
 */

/**
 * Globs des entités TypeORM.
 *
 * Les entités TypeORM vivent exclusivement dans les couches
 * `infrastructure` des modules, jamais dans le domaine.
 */
export const TYPEORM_ENTITIES_GLOB =
  'src/modules/**/infrastructure/**/*.entity{.ts,.js}';

/** Emplacement des migrations (source TypeScript). */
export const TYPEORM_MIGRATIONS_GLOB = 'src/database/migrations/*{.ts,.js}';

/** Nom de la table technique de suivi des migrations TypeORM. */
export const TYPEORM_MIGRATIONS_TABLE = 'typeorm_migrations';
