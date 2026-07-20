import { Injectable } from '@nestjs/common';
import { AuthSession } from '../domain/auth-session';
import { AuthSessionEntity } from './entities/auth-session.entity';

/** Conversion entité TypeORM <-> modèle de domaine des sessions. */
@Injectable()
export class AuthSessionMapper {
  toDomain(entity: AuthSessionEntity): AuthSession {
    return new AuthSession(
      entity.id,
      entity.userId,
      entity.refreshTokenHash,
      entity.tokenFamilyId,
      entity.userAgent,
      entity.ipAddress,
      entity.lastUsedAt,
      entity.expiresAt,
      entity.revokedAt,
      entity.revocationReason,
      entity.createdAt,
    );
  }
}
