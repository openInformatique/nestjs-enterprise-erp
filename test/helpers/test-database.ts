import { DataSource } from 'typeorm';
import { TYPEORM_MIGRATIONS_TABLE } from '../../src/database/database.constants';
import { AuditLogEntity } from '../../src/modules/audit/infrastructure/entities/audit-log.entity';
import { AuthSessionEntity } from '../../src/modules/authentication/infrastructure/entities/auth-session.entity';
import { UserEntity } from '../../src/modules/users/infrastructure/entities/user.entity';

/**
 * DataSource dédié aux tests d'intégration.
 *
 * - pointe vers la base *_test (garanti par load-test-env.ts) ;
 * - exécute les migrations au démarrage (migrationsRun) : le schéma des
 *   tests est TOUJOURS celui produit par les migrations, jamais un
 *   schéma synchronisé.
 */
export function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'mssql',
    host: process.env.DB_HOST as string,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE as string,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    },
    entities: [UserEntity, AuthSessionEntity, AuditLogEntity],
    migrations: ['src/database/migrations/*.ts'],
    migrationsTableName: TYPEORM_MIGRATIONS_TABLE,
    migrationsRun: true,
    synchronize: false,
  });
}
