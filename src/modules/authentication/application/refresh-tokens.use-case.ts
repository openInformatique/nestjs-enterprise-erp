import { Inject, Injectable } from '@nestjs/common';
import {
  RefreshTokenInvalidException,
  RefreshTokenReuseDetectedException,
  SessionExpiredException,
  SessionRevokedException,
} from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { SessionRevocationReason } from '../domain/auth-session';
import { AUTH_SESSION_REPOSITORY } from '../domain/auth-session-repository.port';
import type { AuthSessionRepositoryPort } from '../domain/auth-session-repository.port';
import { GeneratedToken, TokenService } from './token.service';

/** Résultat d'un rafraîchissement réussi. */
export interface RefreshResult {
  accessToken: GeneratedToken;
  refreshToken: GeneratedToken;
  userId: string;
}

/**
 * Cas d'utilisation : rotation des jetons.
 *
 * À chaque rafraîchissement :
 *   1. vérifie la signature du refresh token ;
 *   2. retrouve la session (claim sid) ;
 *   3. compare l'empreinte du token reçu avec celle stockée : une
 *      divergence signifie qu'un ANCIEN token de la famille est rejoué
 *      → compromission présumée, révocation de toute la famille,
 *      audit de sécurité, refus avec REFRESH_TOKEN_REUSE_DETECTED ;
 *   4. vérifie révocation et expiration de la session ;
 *   5. génère un nouveau refresh token et remplace l'empreinte stockée
 *      (rotation), met à jour last_used_at ;
 *   6. renvoie un nouvel access token.
 *
 * Note : le nouveau refresh token conserve la date d'expiration de la
 * session (la rotation ne prolonge pas la durée de vie accordée au login).
 */
@Injectable()
export class RefreshTokensUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepository: AuthSessionRepositoryPort,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async execute(refreshToken: string): Promise<RefreshResult> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    const session = await this.sessionRepository.findById(payload.sid);
    if (!session) {
      throw new RefreshTokenInvalidException();
    }

    // Détection de réutilisation AVANT tout : un ancien token rejoué sur
    // une session (même révoquée) révèle une compromission potentielle.
    const receivedHash = this.tokenService.hashRefreshToken(refreshToken);
    if (receivedHash !== session.refreshTokenHash) {
      const revokedCount = await this.sessionRepository.revokeFamily(
        session.tokenFamilyId,
        SessionRevocationReason.TokenReuseDetected,
        new Date(),
      );
      await this.auditService.record({
        category: AuditCategory.Security,
        action: 'auth.refresh-token.reuse-detected',
        actorUserId: session.userId,
        resourceType: 'auth_session',
        resourceId: session.id,
        metadata: {
          tokenFamilyId: session.tokenFamilyId,
          revokedSessions: revokedCount,
        },
      });
      throw new RefreshTokenReuseDetectedException();
    }

    if (session.isRevoked()) {
      throw new SessionRevokedException();
    }
    if (session.isExpired()) {
      throw new SessionExpiredException();
    }

    const [accessToken, newRefreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(session.userId, session.id),
      this.tokenService.generateRefreshToken(session.userId, session.id),
    ]);

    await this.sessionRepository.rotateRefreshToken(
      session.id,
      this.tokenService.hashRefreshToken(newRefreshToken.token),
      new Date(),
    );

    await this.auditService.record({
      category: AuditCategory.Security,
      action: 'auth.token.refreshed',
      actorUserId: session.userId,
      resourceType: 'auth_session',
      resourceId: session.id,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      userId: session.userId,
    };
  }
}
