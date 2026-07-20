import {
  Controller,
  Get,
  NotFoundException,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipResponseEnvelope } from '../../common/decorators/skip-response-envelope.decorator';
import { MetricsService } from './metrics.service';

/**
 * Endpoint d'exposition Prometheus : GET /metrics.
 *
 * - hors préfixe /api et hors versionnement (chemin attendu par les
 *   collecteurs Prometheus) ;
 * - sans enveloppe JSON (format texte d'exposition Prometheus) ;
 * - désactivable par configuration (METRICS_ENABLED=false → 404) ;
 * - public dans cette version : EN PRODUCTION, il devra être protégé par
 *   le réseau, un reverse proxy ou une authentification dédiée
 *   (voir docs/observability.md).
 */
@ApiExcludeController()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @SkipResponseEnvelope()
  @Get()
  async getMetrics(@Res() response: Response): Promise<void> {
    if (!this.metricsService.enabled) {
      throw new NotFoundException();
    }
    response
      .setHeader('Content-Type', this.metricsService.contentType)
      .send(await this.metricsService.render());
  }
}
