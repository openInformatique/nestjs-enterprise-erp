import { Module } from '@nestjs/common';
import { GetDashboardUseCase } from './application/get-dashboard.use-case';
import { DashboardQueryService } from './infrastructure/dashboard-query.service';
import { DashboardController } from './presentation/dashboard.controller';

/**
 * Module du tableau de bord.
 *
 * AUCUN import : pas de TypeOrmModule.forFeature (aucune entité), pas
 * de module métier (le service lit les TABLES, pas les classes — la
 * DataSource de TypeORM est globale). Le module le plus léger du
 * projet : il peut disparaître sans qu'un seul autre le remarque.
 *
 * Rien n'est exporté : personne ne consomme un tableau de bord.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardQueryService, GetDashboardUseCase],
})
export class DashboardModule {}
