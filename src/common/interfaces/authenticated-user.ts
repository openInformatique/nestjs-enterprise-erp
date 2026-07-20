/**
 * Utilisateur authentifié tel qu'exposé dans le contexte HTTP.
 *
 * Type strict et minimal : les contrôleurs n'accèdent JAMAIS à l'entité
 * TypeORM ni au modèle de domaine complet via la requête. Récupéré dans
 * les handlers avec le décorateur @CurrentUser().
 */
export interface AuthenticatedUser {
  /** Identifiant de l'utilisateur (claim sub du JWT). */
  userId: string;
  /** Identifiant de la session porteuse (claim sid du JWT). */
  sessionId: string;
}
