// L'import de bootstrap-env DOIT précéder celui d'AppModule : il charge
// les .env dont dépend l'inclusion conditionnelle de certains modules.
import './bootstrap-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { SwaggerConfig, swaggerConfig } from './config/swagger.config';
import { setupSwagger } from './documentation/swagger.setup';

/**
 * Point d'entrée de l'application.
 *
 * La configuration transverse (sécurité HTTP, validation, enveloppe,
 * erreurs, versionnement) est appliquée par configureApp — partagée avec
 * les tests end-to-end. Ce fichier n'ajoute que ce qui est propre au
 * démarrage réel : logger Pino, Swagger et écoute réseau.
 */
async function bootstrap(): Promise<void> {
  // bufferLogs : les logs émis avant l'installation de Pino sont
  // conservés puis rejoués via le logger structuré.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));

  const config = configureApp(app);

  // Documentation OpenAPI (désactivable par configuration).
  setupSwagger(app, config, app.get<SwaggerConfig>(swaggerConfig.KEY));

  await app.listen(config.port, config.host);

  Logger.log(
    `${config.name} démarré sur http://${config.host}:${config.port}/` +
      `${config.globalPrefix}/v${config.version} (environnement : ${config.environment})`,
    'Bootstrap',
  );
}

// Un échec au démarrage doit arrêter le processus avec un code d'erreur
// explicite plutôt que de laisser une promesse rejetée silencieuse.
bootstrap().catch((error: unknown) => {
  console.error('Échec du démarrage de l’application :', error);
  process.exit(1);
});
