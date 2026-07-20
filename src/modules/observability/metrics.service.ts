import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';
import { observabilityConfig } from '../../config/observability.config';

/**
 * Service de métriques Prometheus.
 *
 * Expose :
 *   - les métriques par défaut du processus Node.js (CPU, mémoire, GC,
 *     event loop) ;
 *   - http_requests_total : compteur par méthode, route normalisée et
 *     statut HTTP ;
 *   - http_request_duration_seconds : histogramme des durées.
 *
 * Cardinalité maîtrisée : les labels ne contiennent QUE la méthode, la
 * route normalisée (gabarit Express, ex. /api/v1/auth/sessions/:id) et
 * le statut. Jamais d'identifiant utilisateur, de session, de request ID,
 * d'URL complète ni d'adresse IP.
 */
@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;

  constructor(
    @Inject(observabilityConfig.KEY)
    private readonly config: ConfigType<typeof observabilityConfig>,
  ) {
    if (this.config.metricsEnabled) {
      collectDefaultMetrics({ register: this.registry });
    }

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Nombre total de requêtes HTTP.',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Durée des requêtes HTTP en secondes.',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  get enabled(): boolean {
    return this.config.metricsEnabled;
  }

  /** Enregistre une requête HTTP terminée. */
  observeHttpRequest(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void {
    if (!this.enabled) {
      return;
    }
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  /** Rendu au format d'exposition Prometheus. */
  async render(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type attendu par les collecteurs Prometheus. */
  get contentType(): string {
    return this.registry.contentType;
  }
}
