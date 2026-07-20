import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { appConfig } from '../../config/app.config';
import { NodeEnvironment } from '../../config/environment.validation';

/**
 * Limites de débit par environnement.
 *
 * - local / development : 100 requêtes par minute et par IP, un plafond
 *   raisonnable pour une API d'entreprise en développement ;
 * - test : plafond très élevé pour ne pas perturber les suites e2e.
 *
 * Les endpoints sensibles (login, refresh) portent des limites PLUS
 * restrictives via @Throttle() directement sur leurs handlers
 * (voir AuthenticationController).
 */
export const THROTTLE_TTL_MS = 60_000;
export const THROTTLE_LIMIT_DEFAULT = 100;
export const THROTTLE_LIMIT_TEST = 10_000;

/**
 * Environnement de test : les valeurs des décorateurs @Throttle sont
 * figées à l'évaluation des classes ; elles doivent donc être calculées
 * ici (NODE_ENV est chargé avant tout import applicatif).
 */
const IS_TEST_ENVIRONMENT = process.env.NODE_ENV === 'test';

/** Limites renforcées des endpoints d'authentification (par minute/IP). */
export const THROTTLE_LIMIT_LOGIN = IS_TEST_ENVIRONMENT
  ? THROTTLE_LIMIT_TEST
  : 5;
export const THROTTLE_LIMIT_REFRESH = IS_TEST_ENVIRONMENT
  ? THROTTLE_LIMIT_TEST
  : 30;

/**
 * Module de limitation de débit.
 *
 * Le guard est global : toute route est protégée par défaut, sans
 * décorateur à ajouter. Les dépassements produisent une réponse 429
 * convertie par le filtre global (code TOO_MANY_REQUESTS).
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (app: ConfigType<typeof appConfig>) => ({
        throttlers: [
          {
            ttl: THROTTLE_TTL_MS,
            limit:
              app.environment === NodeEnvironment.Test
                ? THROTTLE_LIMIT_TEST
                : THROTTLE_LIMIT_DEFAULT,
          },
        ],
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class ThrottlingModule {}
