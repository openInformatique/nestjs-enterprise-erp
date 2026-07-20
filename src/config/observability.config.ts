import { registerAs } from '@nestjs/config';

/** Configuration de l'observabilité (métriques et tâches planifiées). */
export interface ObservabilityConfig {
  metricsEnabled: boolean;
  schedulerEnabled: boolean;
}

export const observabilityConfig = registerAs(
  'observability',
  (): ObservabilityConfig => ({
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    schedulerEnabled: process.env.SCHEDULER_ENABLED === 'true',
  }),
);
