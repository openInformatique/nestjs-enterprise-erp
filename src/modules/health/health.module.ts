import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/**
 * Module de santé de l'application.
 *
 * Expose les sondes health / live / ready (publiques). La readiness
 * vérifie la connexion SQL Server via TypeORM.
 */
@Module({
  imports: [
    TerminusModule.forRoot({
      // Les erreurs de sonde sont déjà visibles dans la réponse HTTP 503 ;
      // le logger par défaut de Terminus est trop verbeux.
      logger: false,
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
