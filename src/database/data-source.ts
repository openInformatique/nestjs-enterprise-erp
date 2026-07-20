import { DataSource } from 'typeorm';
import { loadScriptDatabaseEnvironment } from './scripts/script-environment';
import {
  TYPEORM_ENTITIES_GLOB,
  TYPEORM_MIGRATIONS_GLOB,
  TYPEORM_MIGRATIONS_TABLE,
} from './database.constants';

/**
 * DataSource dédié à la CLI TypeORM (migrations).
 *
 * L'application NestJS n'utilise PAS ce fichier : elle configure sa propre
 * connexion via DatabaseModule et la configuration typée. Ce DataSource
 * partage néanmoins les mêmes variables d'environnement afin que la CLI
 * et l'application voient exactement le même schéma.
 *
 * Usage :
 *   npm run migration:run          (base de l'environnement courant)
 *   npm run migration:run:test     (base de test)
 */
const env = loadScriptDatabaseEnvironment();

export default new DataSource({
  type: 'mssql',
  host: env.host,
  port: env.port,
  username: env.username,
  password: env.password,
  database: env.database,
  options: {
    encrypt: env.encrypt,
    trustServerCertificate: env.trustServerCertificate,
  },
  entities: [TYPEORM_ENTITIES_GLOB],
  migrations: [TYPEORM_MIGRATIONS_GLOB],
  migrationsTableName: TYPEORM_MIGRATIONS_TABLE,
  // Règle absolue du socle : le schéma n'évolue que par migrations.
  synchronize: false,
  logging: false,
});
