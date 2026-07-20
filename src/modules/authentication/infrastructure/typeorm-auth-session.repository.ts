import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { AuthSession } from '../domain/auth-session';
import {
  AuthSessionRepositoryPort,
  CreateAuthSessionInput,
} from '../domain/auth-session-repository.port';
import { AuthSessionEntity } from './entities/auth-session.entity';
import { AuthSessionMapper } from './auth-session.mapper';

/**
 * Implémentation TypeORM du repository de sessions.
 *
 * Les révocations de masse (famille, utilisateur) utilisent des UPDATE
 * ciblés ne touchant que les sessions encore actives, afin de préserver
 * la raison de révocation d'origine des sessions déjà révoquées.
 */
@Injectable()
export class TypeOrmAuthSessionRepository implements AuthSessionRepositoryPort {
  constructor(
    @InjectRepository(AuthSessionEntity)
    private readonly repository: Repository<AuthSessionEntity>,
    private readonly mapper: AuthSessionMapper,
  ) {}

  async create(input: CreateAuthSessionInput): Promise<AuthSession> {
    const entity = this.repository.create({
      id: input.sessionId,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      tokenFamilyId: input.tokenFamilyId,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      expiresAt: input.expiresAt,
      lastUsedAt: null,
      revokedAt: null,
      revocationReason: null,
    });
    const saved = await this.repository.save(entity);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<AuthSession | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findActiveByUserId(userId: string): Promise<AuthSession[]> {
    const entities = await this.repository.find({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async rotateRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string,
    lastUsedAt: Date,
  ): Promise<void> {
    await this.repository.update(
      { id: sessionId },
      { refreshTokenHash: newRefreshTokenHash, lastUsedAt },
    );
  }

  async revoke(
    sessionId: string,
    reason: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.repository.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt, revocationReason: reason },
    );
  }

  async revokeFamily(
    tokenFamilyId: string,
    reason: string,
    revokedAt: Date,
  ): Promise<number> {
    const result = await this.repository.update(
      { tokenFamilyId, revokedAt: IsNull() },
      { revokedAt, revocationReason: reason },
    );
    return result.affected ?? 0;
  }

  async revokeAllForUser(
    userId: string,
    reason: string,
    revokedAt: Date,
  ): Promise<number> {
    const result = await this.repository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt, revocationReason: reason },
    );
    return result.affected ?? 0;
  }

  async deleteExpiredBefore(threshold: Date): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: LessThan(threshold),
    });
    return result.affected ?? 0;
  }
}
