import { RequestMethod, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { createGlobalValidationPipe } from './common/pipes/global-validation.pipe';
import { AppConfig, appConfig } from './config/app.config';
import { NodeEnvironment } from './config/environment.validation';

/**
 * Applique la configuration transverse de l'application.
 *
 * Partagée entre le démarrage réel (main.ts) et les tests end-to-end :
 * les tests exercent EXACTEMENT la même chaîne HTTP que la production
 * (sécurité, validation, enveloppe, erreurs).
 */
export function configureApp(app: NestExpressApplication): AppConfig {
  const config = app.get<AppConfig>(appConfig.KEY);
  const isLocal = config.environment === NodeEnvironment.Local;

  // Express expose par défaut l'en-tête X-Powered-By : supprimé pour ne
  // pas révéler la pile technique.
  app.disable('x-powered-by');

  // En-têtes de sécurité HTTP (CSP, HSTS, no-sniff, frameguard...).
  app.use(helmet());

  // Lecture du cookie HttpOnly de refresh token.
  app.use(cookieParser());

  // Limitation de la taille des corps HTTP : 1 Mo suffit pour du JSON
  // applicatif ; les uploads de fichiers passent par multipart (Multer)
  // avec leur propre limite issue de la configuration de stockage.
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  // CORS : liste blanche stricte issue de la configuration. Jamais
  // d'origine totalement ouverte : les credentials (cookie de refresh
  // token) sont activés.
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  // /metrics reste hors du préfixe /api : chemin standard attendu par
  // les collecteurs Prometheus.
  app.setGlobalPrefix(config.globalPrefix, {
    exclude: [{ path: 'metrics', method: RequestMethod.GET }],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: config.version,
  });

  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter(isLocal));
  app.useGlobalInterceptors(
    new ResponseEnvelopeInterceptor(app.get(Reflector)),
  );

  return config;
}
