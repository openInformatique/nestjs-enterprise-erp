import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Interceptor global d'instrumentation HTTP.
 *
 * Mesure la durée de chaque requête et alimente les métriques avec la
 * route NORMALISÉE (gabarit Express avec :param, jamais l'URL réelle) :
 * la cardinalité des labels reste bornée.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.metricsService.enabled || context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    const record = (): void => {
      const durationSeconds =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      // request.route est défini une fois le handler résolu ; les 404
      // de route inconnue sont regroupés sous "unmatched".
      const route =
        (request.route as { path?: string } | undefined)?.path ?? 'unmatched';
      this.metricsService.observeHttpRequest(
        request.method,
        route,
        response.statusCode,
        durationSeconds,
      );
    };

    return next.handle().pipe(
      tap({
        next: record,
        error: record,
      }),
    );
  }
}
