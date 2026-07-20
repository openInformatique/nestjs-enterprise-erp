import { registerAs } from '@nestjs/config';
import { NodeEnvironment } from './environment.validation';

/** Configuration générale de l'application. */
export interface AppConfig {
  environment: NodeEnvironment;
  name: string;
  host: string;
  port: number;
  globalPrefix: string;
  version: string;
  corsOrigins: string[];
  /** Active les endpoints de démonstration technique (mail, fichiers, PDF). */
  technicalDemoEndpointsEnabled: boolean;
}

/**
 * Les variables ont déjà été validées par `validateEnvironment` :
 * les lectures directes de process.env sont donc sûres ici, et ce
 * fichier est l'un des seuls endroits autorisés à y accéder.
 */
export const appConfig = registerAs('app', (): AppConfig => ({
  environment: process.env.NODE_ENV as NodeEnvironment,
  name: process.env.APP_NAME as string,
  host: process.env.APP_HOST as string,
  port: Number(process.env.APP_PORT),
  globalPrefix: process.env.APP_GLOBAL_PREFIX as string,
  version: process.env.APP_VERSION as string,
  corsOrigins: (process.env.APP_CORS_ORIGINS as string)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  technicalDemoEndpointsEnabled:
    process.env.TECHNICAL_DEMO_ENDPOINTS_ENABLED === 'true',
}));
