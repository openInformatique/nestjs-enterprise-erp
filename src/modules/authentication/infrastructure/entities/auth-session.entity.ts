import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../../users/infrastructure/entities/user.entity';

/**
 * Entité TypeORM de la table `auth_sessions`.
 *
 * Une session représente un couple utilisateur / refresh token actif.
 *
 * Sécurité :
 *   - le refresh token n'est JAMAIS stocké en clair : seule son empreinte
 *     (hash) est conservée ;
 *   - `tokenFamilyId` identifie la famille issue d'un même login ; à chaque
 *     rotation le hash change mais la famille reste. La réutilisation d'un
 *     ancien token de la famille signale une compromission : toute la
 *     famille est alors révoquée ;
 *   - une session révoquée (revokedAt non nul) ne peut plus renouveler de
 *     jeton, même si son refresh token n'a pas expiré.
 *
 * Cette entité n'étend pas AuditableEntity : une session n'est pas
 * "soft-deletée" et n'a pas de créateur applicatif distinct de son user.
 */
@Entity({ name: 'auth_sessions' })
export class AuthSessionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Index('IDX_auth_sessions_user_id')
  @Column({ name: 'user_id', type: 'uniqueidentifier' })
  userId!: string;

  /**
   * Relation vers l'utilisateur, en lecture seule (jamais de cascade) :
   * la suppression d'un utilisateur est logique (soft delete), les
   * sessions sont révoquées applicativement.
   */
  @ManyToOne(() => UserEntity, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  /** Empreinte (hash) du refresh token courant de la session. */
  @Column({ name: 'refresh_token_hash', type: 'nvarchar', length: 500 })
  refreshTokenHash!: string;

  /** Famille de tokens issue d'un même login (rotation). */
  @Index('IDX_auth_sessions_token_family_id')
  @Column({ name: 'token_family_id', type: 'uniqueidentifier' })
  tokenFamilyId!: string;

  @Column({ name: 'user_agent', type: 'nvarchar', length: 500, nullable: true })
  userAgent!: string | null;

  /** IPv4 ou IPv6 textuelle (45 caractères max). */
  @Column({ name: 'ip_address', type: 'nvarchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'last_used_at', type: 'datetime2', nullable: true })
  lastUsedAt!: Date | null;

  @Index('IDX_auth_sessions_expires_at')
  @Column({ name: 'expires_at', type: 'datetime2' })
  expiresAt!: Date;

  @Index('IDX_auth_sessions_revoked_at')
  @Column({ name: 'revoked_at', type: 'datetime2', nullable: true })
  revokedAt!: Date | null;

  @Column({
    name: 'revocation_reason',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  revocationReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
  updatedAt!: Date;
}
