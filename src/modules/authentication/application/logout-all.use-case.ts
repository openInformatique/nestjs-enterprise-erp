import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { SessionRevocationReason } from '../domain/auth-session';
import { AUTH_SESSION_REPOSITORY } from '../domain/auth-session-repository.port';
import type { AuthSessionRepositoryPort } from '../domain/auth-session-repository.port';

/**
 * Cas d'utilisation : déconnexion de TOUTES les sessions de l'utilisateur.
 *
 * Révoque l'ensemble des sessions actives (tous appareils confondus).
 */
@Injectable()
export class LogoutAllUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepository: AuthSessionRepositoryPort,
    private readonly auditService: AuditService,
  ) {}

  /** Renvoie le nombre de sessions révoquées. */
  async execute(userId: string): Promise<number> {
    const revokedCount = await this.sessionRepository.revokeAllForUser(
      userId,
      SessionRevocationReason.LogoutAll,
      new Date(),
    );

    await this.auditService.record({
      category: AuditCategory.Security,
      action: 'auth.logout-all',
      actorUserId: userId,
      metadata: { revokedSessions: revokedCount },
    });

    return revokedCount;
  }
}
