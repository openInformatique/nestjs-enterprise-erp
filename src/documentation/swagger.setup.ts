import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfig } from '../config/app.config';
import { SwaggerConfig } from '../config/swagger.config';
import { PaginationMetaDto } from '../common/pagination/pagination-meta.dto';

/**
 * Configuration Swagger / OpenAPI du socle.
 *
 * - interface : /api/docs — document JSON : /api/docs-json ;
 * - désactivable par configuration (SWAGGER_ENABLED=false) ;
 * - documente l'authentification Bearer (access token) et le cookie
 *   HttpOnly de refresh token ;
 * - décrit l'enveloppe standardisée appliquée à toutes les réponses JSON.
 *
 * Aucun secret réel n'apparaît dans cette documentation.
 */
export function setupSwagger(
  app: INestApplication,
  appConfiguration: AppConfig,
  swaggerConfiguration: SwaggerConfig,
): void {
  if (!swaggerConfiguration.enabled) {
    return;
  }

  const documentBuilder = new DocumentBuilder()
    .setTitle(appConfiguration.name)
    .setDescription(
      `Socle back-end d'entreprise NestJS.

## Enveloppe standardisée des réponses

Toutes les réponses JSON (hors téléchargements, flux et métriques) sont enveloppées :

\`\`\`json
{
  "success": true,
  "data": { },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-07-14T08:30:00.000Z",
    "pagination": { "page": 1, "limit": 20, "totalItems": 48, "totalPages": 3, "hasNextPage": true, "hasPreviousPage": false }
  }
}
\`\`\`

\`meta.pagination\` n'apparaît que sur les listes paginées.

## Format des erreurs

\`\`\`json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données transmises sont invalides.",
    "details": [{ "field": "email", "message": "L'adresse e-mail n'est pas valide." }]
  },
  "meta": { "requestId": "uuid", "timestamp": "...", "path": "/api/v1/..." }
}
\`\`\`

Les codes d'erreur (\`error.code\`) sont stables et contractuels :
VALIDATION_ERROR, AUTHENTICATION_FAILED, ACCESS_TOKEN_INVALID,
REFRESH_TOKEN_INVALID, SESSION_EXPIRED, SESSION_REVOKED,
REFRESH_TOKEN_REUSE_DETECTED, RESOURCE_NOT_FOUND, RESOURCE_ALREADY_EXISTS,
DATABASE_ERROR, FILE_NOT_FOUND, FILE_TYPE_NOT_ALLOWED, FILE_TOO_LARGE,
TOO_MANY_REQUESTS, INTERNAL_SERVER_ERROR.

## Authentification

- **Access token** : en-tête \`Authorization: Bearer <token>\` (bouton Authorize).
- **Refresh token** : cookie HttpOnly \`refresh_token\` limité aux routes /auth,
  géré automatiquement par le navigateur ; jamais accessible au JavaScript.

Les routes publiques sont : login, refresh, santé (health/live/ready).
Toutes les autres routes exigent un access token valide.`,
    )
    .setVersion(appConfiguration.version)
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: "Jeton d'accès obtenu via POST /auth/login.",
    })
    .addCookieAuth('refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refresh_token',
      description:
        'Cookie HttpOnly déposé au login, utilisé par POST /auth/refresh.',
    })
    .addTag('Authentification', 'Login, rotation de jetons, sessions')
    .addTag('Santé', "Sondes de disponibilité de l'application")
    .addTag(
      'Démonstration technique',
      'Endpoints de démonstration (TECHNICAL_DEMO_ENDPOINTS_ENABLED=true)',
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentBuilder, {
    // Modèles transverses référencés par l'enveloppe.
    extraModels: [PaginationMetaDto],
  });

  SwaggerModule.setup(swaggerConfiguration.path, app, document, {
    jsonDocumentUrl: swaggerConfiguration.jsonPath,
    customSiteTitle: `${appConfiguration.name} — API`,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
