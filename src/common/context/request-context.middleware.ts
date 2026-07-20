import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER, resolveRequestId } from '../utils/request-id.util';
import { RequestContextService } from './request-context.service';

/**
 * Middleware d'ouverture du contexte de requête.
 *
 * Pour chaque requête :
 *   1. résout l'identifiant unique (réutilise x-request-id s'il est
 *      valide, sinon génère un UUID) ;
 *   2. le renvoie dans l'en-tête de réponse x-request-id ;
 *   3. ouvre le contexte AsyncLocalStorage avec les informations
 *      réseau (IP, user-agent) et l'horodatage de début.
 *
 * Doit être appliqué à TOUTES les routes, avant tout autre traitement.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = resolveRequestId(request);
    response.setHeader(REQUEST_ID_HEADER, requestId);

    this.requestContext.run(
      {
        requestId,
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
        startedAt: new Date(),
      },
      () => next(),
    );
  }
}
