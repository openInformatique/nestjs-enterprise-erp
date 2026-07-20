/**
 * Données disponibles dans le contexte de la requête courante.
 *
 * Alimentées par RequestContextMiddleware (requestId, ip, user-agent,
 * startedAt) puis enrichies par le guard JWT (userId, sessionId).
 */
export interface RequestContextData {
  requestId: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  startedAt: Date;
}
