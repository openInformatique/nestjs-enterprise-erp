import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Endpoints de santé de l'application.
 *
 * - GET /health/live  : le processus répond (liveness) ;
 * - GET /health/ready : les dépendances critiques répondent, notamment
 *   SQL Server (readiness) ;
 * - GET /health       : synthèse (équivalente à ready dans cette version).
 *
 * Publics par nécessité (sondes d'infrastructure), ils n'exposent aucun
 * secret : uniquement des statuts up/down par composant.
 */
@ApiTags('Santé')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly databaseIndicator: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: "Synthèse de santé de l'application",
    description: 'Vérifie le processus et la connexion SQL Server.',
  })
  @ApiOkResponse({ description: 'Application et dépendances en bon état.' })
  check(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.databaseIndicator.pingCheck('database', { timeout: 3000 }),
    ]);
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({
    summary: 'Sonde de vivacité (liveness)',
    description: 'Répond dès que le processus HTTP est opérationnel.',
  })
  @ApiOkResponse({ description: 'Processus vivant.' })
  live(): Promise<HealthCheckResult> {
    // Aucun indicateur : si cette route répond, le processus vit.
    return this.healthCheckService.check([]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Sonde de disponibilité (readiness)',
    description:
      'Vérifie que SQL Server est joignable : tant que ce n’est pas le ' +
      'cas, l’application ne doit pas recevoir de trafic.',
  })
  @ApiOkResponse({ description: 'Application prête à recevoir du trafic.' })
  ready(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.databaseIndicator.pingCheck('database', { timeout: 3000 }),
    ]);
  }
}
