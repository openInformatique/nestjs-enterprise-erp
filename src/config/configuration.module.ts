import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { authConfig } from './auth.config';
import { databaseConfig } from './database.config';
import { validateEnvironment } from './environment.validation';
import { loggingConfig } from './logging.config';
import { mailConfig } from './mail.config';
import { observabilityConfig } from './observability.config';
import { storageConfig } from './storage.config';
import { swaggerConfig } from './swagger.config';

/**
 * Module global de configuration.
 *
 * Charge le fichier .env correspondant à NODE_ENV, valide toutes les
 * variables au démarrage (refus de démarrer en cas d'erreur) et expose
 * les configurations typées par domaine via ConfigService.
 *
 * C'est le seul point d'accès autorisé à process.env : le reste de
 * l'application consomme exclusivement les objets de configuration typés.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Le fichier spécifique à l'environnement prime sur .env.
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'local'}`, '.env'],
      validate: validateEnvironment,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        loggingConfig,
        mailConfig,
        observabilityConfig,
        storageConfig,
        swaggerConfig,
      ],
    }),
  ],
})
export class ConfigurationModule {}
