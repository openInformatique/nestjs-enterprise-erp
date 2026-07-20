import { AuthSession } from './auth-session';

/** Données de création d'une session. */
export interface CreateAuthSessionInput {
  /**
   * Identifiant fourni par le cas d'utilisation : il doit figurer dans
   * les claims des jetons émis AVANT l'insertion de la ligne.
   */
  sessionId: string;
  userId: string;
  refreshTokenHash: string;
  tokenFamilyId: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
}

/**
 * Contrat de persistance des sessions d'authentification.
 */
export interface AuthSessionRepositoryPort {
  create(input: CreateAuthSessionInput): Promise<AuthSession>;

  /** Recherche par identifiant, révoquées et expirées comprises. */
  findById(id: string): Promise<AuthSession | null>;

  /** Sessions actives (non révoquées, non expirées) d'un utilisateur. */
  findActiveByUserId(userId: string): Promise<AuthSession[]>;

  /** Remplace l'empreinte du refresh token lors d'une rotation. */
  rotateRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string,
    lastUsedAt: Date,
  ): Promise<void>;

  /** Révoque une session précise. */
  revoke(sessionId: string, reason: string, revokedAt: Date): Promise<void>;

  /** Révoque toutes les sessions d'une famille de tokens (compromission). */
  revokeFamily(
    tokenFamilyId: string,
    reason: string,
    revokedAt: Date,
  ): Promise<number>;

  /** Révoque toutes les sessions actives d'un utilisateur. */
  revokeAllForUser(
    userId: string,
    reason: string,
    revokedAt: Date,
  ): Promise<number>;

  /**
   * Supprime les sessions expirées avant la date donnée (nettoyage
   * périodique du scheduler). Renvoie le nombre de lignes supprimées.
   */
  deleteExpiredBefore(threshold: Date): Promise<number>;
}

/** Jeton d'injection du repository de sessions. */
export const AUTH_SESSION_REPOSITORY = Symbol('AUTH_SESSION_REPOSITORY');
