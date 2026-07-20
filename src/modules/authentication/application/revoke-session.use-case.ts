import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuditCategory } from '../../audit/domain/audit-category.enum';
import { SessionRevocationReason } from '../domain/auth-session';
import { AUTH_SESSION_REPOSITORY } from '../domain/auth-session-repository.port';
import type { AuthSessionRepositoryPort } from '../domain/auth-session-repository.port';

/**
 * Cas d'utilisation : révoquer une session précise de l'utilisateur.
 *
 * Un utilisateur ne peut révoquer QUE ses propres sessions : une session
 * appartenant à un autre utilisateur est traitée comme introuvable
 * (aucune fuite d'information sur l'existence de la session).
 */
@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepository: AuthSessionRepositoryPort,
    private readonly auditService: AuditService,
  ) {}

  async execute(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session || session.userId !== userId) {
      throw new ResourceNotFoundException('La session');
    }
    if (session.isRevoked()) {
      // Révocation idempotente : une session déjà révoquée reste révoquée.
      return;
    }

    await this.sessionRepository.revoke(
      sessionId,
      SessionRevocationReason.RevokedByUser,
      new Date(),
    );

    await this.auditService.record({
      category: AuditCategory.Security,
      action: 'auth.session.revoked',
      actorUserId: userId,
      resourceType: 'auth_session',
      resourceId: sessionId,
    });
  }
}
