import { registerAs } from '@nestjs/config';

/** Configuration de la documentation Swagger / OpenAPI. */
export interface SwaggerConfig {
  enabled: boolean;
  /** Chemin de l'interface Swagger UI. */
  path: string;
  /** Chemin du document OpenAPI JSON. */
  jsonPath: string;
}

export const swaggerConfig = registerAs('swagger', (): SwaggerConfig => ({
  enabled: process.env.SWAGGER_ENABLED === 'true',
  path: 'api/docs',
  jsonPath: 'api/docs-json',
}));
