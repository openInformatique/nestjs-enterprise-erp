import { randomUUID } from 'node:crypto';
import { Request } from 'express';

/** En-tête HTTP de propagation de l'identifiant de requête. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Format accepté pour un identifiant fourni par le client. */
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Clé interne de mise en cache sur l'objet Request Express. */
interface RequestWithId extends Request {
  __requestId?: string;
}

/**
 * Résout l'identifiant unique de la requête courante.
 *
 * Règles :
 *   - réutilise l'en-tête `x-request-id` s'il est présent ET valide
 *     (format contrôlé pour éviter l'injection de contenu arbitraire
 *     dans les logs) ;
 *   - sinon génère un UUID ;
 *   - met le résultat en cache sur la requête afin que middleware,
 *     interceptors et filtres voient tous le même identifiant.
 */
export function resolveRequestId(request: Request): string {
  const requestWithId = request as RequestWithId;
  if (requestWithId.__requestId) {
    return requestWithId.__requestId;
  }

  const fromHeader = request.get(REQUEST_ID_HEADER);
  const requestId =
    fromHeader && VALID_REQUEST_ID.test(fromHeader) ? fromHeader : randomUUID();

  requestWithId.__requestId = requestId;
  return requestId;
}
