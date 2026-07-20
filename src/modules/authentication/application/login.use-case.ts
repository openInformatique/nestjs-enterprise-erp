import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContextService } from '../../../common/context/request-context.service';
import { AuthenticationFailedException } from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { USER_REPOSITORY } from '../../users/domain/user-repository.port';
import type { UserRepositoryPort } from '../../users/domain/user-repository.port';
import { AUTH_SESSION_REPOSITORY } from '../domain/auth-session-repository.port';
import type { AuthSessionRepositoryPort } from '../domain/auth-session-repository.port';
import { IDENTITY_PROVIDER } from '../domain/identity-provider.port';
import type { IdentityProviderPort } from '../domain/identity-provider.port';
import { GeneratedToken, TokenService } from './token.service';

/** Résultat d'un login réussi. */
export interface LoginResult {
  accessToken: GeneratedToken;
  refreshToken: GeneratedToken;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
}

/**
 * Cas d'utilisation : authentification locale.
 *
 * Déroulé :
 *   1. délègue la vérification d'identité au fournisseur (normalisation
 *      de l'e-mail, existence, compte actif, mot de passe) ;
 *   2. crée une session avec une nouvelle famille de tokens ;
 *   3. génère les jetons (access + refresh) ;
 *   4. stocke uniquement l'empreinte du refresh token ;
 *   5. enregistre l'audit de sécurité ;
 *   6. met à jour last_login_at.
 *
 * En cas d'échec, un audit `auth.login.failed` est enregistré et le
 * message renvoyé reste volontairement générique.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepository: AuthSessionRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    const identity = await this.authenticateOrAudit(email, password);

    // L'identifiant de session est généré ici : il doit figurer dans les
    // claims des jetons AVANT l'insertion de la ligne de session.
    const sessionId = randomUUID();
    const tokenFamilyId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(identity.userId, sessionId),
      this.tokenService.generateRefreshToken(identity.userId, sessionId),
    ]);

    const context = this.requestContext.get();
    await this.sessionRepository.create({
      userId: identity.userId,
      refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken.token),
      tokenFamilyId,
      userAgent: context?.userAgent ?? null,
      ipAddress: context?.ipAddress ?? null,
      expiresAt: refreshToken.expiresAt,
      sessionId,
    });

    await this.userRepository.updateLastLoginAt(identity.userId, new Date());

    await this.auditService.record({
      category: AuditCategory.Security,
      action: 'auth.login.success',
      actorUserId: identity.userId,
      resourceType: 'auth_session',
      resourceId: sessionId,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: identity.userId,
        email: identity.email,
        displayName: identity.displayName,
      },
    };
  }

  private async authenticateOrAudit(
    email: string,
    password: string,
  ): Promise<{ userId: string; email: string; displayName: string }> {
    try {
      return await this.identityProvider.authenticate({
        type: 'local',
        email,
        password,
      });
    } catch (error) {
      if (error instanceof AuthenticationFailedException) {
        await this.auditService.record({
          category: AuditCategory.Security,
          action: 'auth.login.failed',
          // L'e-mail tenté est conservé dans les métadonnées : utile à la
          // détection d'attaques ; jamais le mot de passe.
          metadata: { attemptedEmail: email },
        });
      }
      throw error;
    }
  }
}
