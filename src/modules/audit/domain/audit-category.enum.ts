/**
 * Catégories d'événements d'audit.
 *
 * Toutes ne sont pas encore utilisées fonctionnellement, mais
 * l'architecture les prévoit dès maintenant :
 *
 * TECHNICAL : événements techniques (génération PDF, envoi d'e-mail...).
 * BUSINESS  : événements métier des futurs modules applicatifs.
 * SECURITY  : authentification, sessions, détection de réutilisation...
 * AUDIT     : événements portant sur le journal d'audit lui-même.
 */
export enum AuditCategory {
  Technical = 'TECHNICAL',
  Business = 'BUSINESS',
  Security = 'SECURITY',
  Audit = 'AUDIT',
}
