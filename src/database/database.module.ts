import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../config/database.config';
import { TYPEORM_MIGRATIONS_TABLE } from './database.constants';
import { TransactionService } from './transaction/transaction.service';

/**
 * Module de connexion à SQL Server via TypeORM.
 *
 * Principes :
 *   - `synchronize` est définitivement désactivé : toute évolution du
 *     schéma passe par une migration versionnée ;
 *   - `autoLoadEntities` : chaque module déclare ses entités via
 *     TypeOrmModule.forFeature, ce module n'a pas à les connaître ;
 *   - la configuration provient exclusivement de la configuration typée.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => ({
        type: 'mssql' as const,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
        options: {
          encrypt: config.encrypt,
          trustServerCertificate: config.trustServerCertificate,
        },
        autoLoadEntities: true,
        migrationsTableName: TYPEORM_MIGRATIONS_TABLE,
        synchronize: false,
      }),
    }),
  ],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class DatabaseModule {}
