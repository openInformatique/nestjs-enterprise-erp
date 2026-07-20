import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { SessionRevocationReason } from '../domain/auth-session';
import { AUTH_SESSION_REPOSITORY } from '../domain/auth-session-repository.port';
import type { AuthSessionRepositoryPort } from '../domain/auth-session-repository.port';

/**
 * Cas d'utilisation : déconnexion de la session courante.
 *
 * La session est révoquée : son refresh token ne peut plus être utilisé.
 * L'access token en cours reste techniquement valide jusqu'à sa courte
 * expiration (voir docs/authentication.md).
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepository: AuthSessionRepositoryPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(userId: string, sessionId: string): Promise<void> {
    await this.sessionRepository.revoke(
      sessionId,
      SessionRevocationReason.Logout,
      new Date(),
    );

    await this.auditService.record({
      category: AuditCategory.Security,
      action: 'auth.logout',
      actorUserId: userId,
      resourceType: 'auth_session',
      resourceId: sessionId,
    });
  }
}
