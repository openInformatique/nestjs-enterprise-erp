import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Request } from 'express';
import { LoggerModule } from 'nestjs-pino';
import { RequestContextService } from '../context/request-context.service';
import { resolveRequestId } from '../utils/request-id.util';
import { appConfig } from '../../config/app.config';
import { NodeEnvironment } from '../../config/environment.validation';
import { loggingConfig } from '../../config/logging.config';

/**
 * Chemins redactés dans TOUS les logs.
 *
 * Couvre les en-têtes d'authentification et de cookies ainsi que les
 * champs sensibles susceptibles d'apparaître dans des objets journalisés
 * (mots de passe, tokens, secrets). La valeur est remplacée par [REDACTED].
 */
const REDACTED_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'refreshTokenHash',
  '*.refreshTokenHash',
  'accessTokenSecret',
  '*.accessTokenSecret',
  'refreshTokenSecret',
  '*.refreshTokenSecret',
  'mailPassword',
  '*.mailPassword',
  'databasePassword',
  '*.databasePassword',
];

/**
 * Module de logs structurés Pino (intégration nestjs-pino).
 *
 * - environnement local : sortie lisible via pino-pretty ;
 * - autres environnements : JSON brut sur stdout, prêt à être collecté
 *   par Loki, Elasticsearch ou tout collecteur de logs Docker (aucune
 *   stack de collecte n'est intégrée au socle : voir docs/observability.md) ;
 * - chaque ligne de log HTTP porte requestId, méthode, route, statut,
 *   durée, IP, user-agent, et userId/sessionId lorsque le contexte de
 *   requête a été enrichi par le guard JWT.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY, loggingConfig.KEY, RequestContextService],
      useFactory: (
        app: ConfigType<typeof appConfig>,
        logging: ConfigType<typeof loggingConfig>,
        requestContext: RequestContextService,
      ) => ({
        pinoHttp: {
          level: logging.level,
          // Réutilise l'identifiant du contexte de requête : logs
          // techniques et audits partagent le même requestId.
          genReqId: (req) => resolveRequestId(req as unknown as Request),
          customProps: () => {
            const context = requestContext.get();
            return {
              userId: context?.userId,
              sessionId: context?.sessionId,
            };
          },
          redact: {
            paths: REDACTED_PATHS,
            censor: '[REDACTED]',
          },
          // Limite la verbosité : pas de dump complet des objets req/res.
          serializers: {
            req: (req: {
              id: string;
              method: string;
              url: string;
              remoteAddress?: string;
              headers?: Record<string, string | undefined>;
            }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              ip: req.remoteAddress,
              userAgent: req.headers?.['user-agent'],
            }),
            res: (res: { statusCode: number }) => ({
              statusCode: res.statusCode,
            }),
          },
          transport:
            app.environment === NodeEnvironment.Local
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                  },
                }
              : undefined,
        },
      }),
    }),
  ],
})
export class LoggingModule {}
