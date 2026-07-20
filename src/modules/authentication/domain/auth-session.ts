/**
 * Modèle de domaine d'une session d'authentification.
 *
 * Classe pure, sans dépendance framework. Représente un couple
 * utilisateur / refresh token, avec sa famille de rotation.
 */
export class AuthSession {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    /** Empreinte SHA-256 du refresh token courant (jamais le token). */
    public readonly refreshTokenHash: string,
    /** Famille de tokens issue d'un même login (suivie lors des rotations). */
    public readonly tokenFamilyId: string,
    public readonly userAgent: string | null,
    public readonly ipAddress: string | null,
    public readonly lastUsedAt: Date | null,
    public readonly expiresAt: Date,
    public readonly revokedAt: Date | null,
    public readonly revocationReason: string | null,
    public readonly createdAt: Date,
  ) {}

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isExpired(reference: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= reference.getTime();
  }

  /** Une session utilisable n'est ni révoquée ni expirée. */
  isUsable(reference: Date = new Date()): boolean {
    return !this.isRevoked() && !this.isExpired(reference);
  }
}

/** Raisons normalisées de révocation d'une session. */
export enum SessionRevocationReason {
  Logout = 'LOGOUT',
  LogoutAll = 'LOGOUT_ALL',
  RevokedByUser = 'REVOKED_BY_USER',
  TokenReuseDetected = 'TOKEN_REUSE_DETECTED',
}
