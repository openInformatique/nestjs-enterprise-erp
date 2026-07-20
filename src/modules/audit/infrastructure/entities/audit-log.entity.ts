import { Column, Entity, Index } from 'typeorm';
import { ImmutableEntity } from '../../../../common/entities/immutable.entity';
import { AuditCategory } from '../../domain/audit-category.enum';

/**
 * Entité TypeORM de la table `audit_logs`.
 *
 * Un audit log est IMMUABLE : aucune mise à jour ni suppression n'est
 * possible via l'API (aucun endpoint dédié n'existe) ; l'entité étend
 * donc ImmutableEntity (pas d'updated_at ni de deleted_at).
 *
 * Les valeurs sensibles (mots de passe, JWT, cookies, refresh tokens)
 * sont filtrées par l'AuditService AVANT insertion : la couche
 * persistance ne reçoit jamais ces données.
 */
@Entity({ name: 'audit_logs' })
export class AuditLogEntity extends ImmutableEntity {
  @Index('IDX_audit_logs_category')
  @Column({ name: 'category', type: 'nvarchar', length: 20 })
  category!: AuditCategory;

  /** Action technique stable, ex. : auth.login.success */
  @Index('IDX_audit_logs_action')
  @Column({ name: 'action', type: 'nvarchar', length: 100 })
  action!: string;

  /** Utilisateur à l'origine de l'événement ; null si anonyme ou système. */
  @Index('IDX_audit_logs_actor_user_id')
  @Column({ name: 'actor_user_id', type: 'uniqueidentifier', nullable: true })
  actorUserId!: string | null;

  /** Type de ressource concernée, ex. : user, auth_session, file. */
  @Column({
    name: 'resource_type',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  resourceType!: string | null;

  @Column({
    name: 'resource_id',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  resourceId!: string | null;

  /** Identifiant de corrélation avec les logs techniques. */
  @Column({ name: 'request_id', type: 'nvarchar', length: 64, nullable: true })
  requestId!: string | null;

  @Column({ name: 'ip_address', type: 'nvarchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'nvarchar', length: 500, nullable: true })
  userAgent!: string | null;

  /** Contexte JSON sérialisé (déjà filtré des valeurs sensibles). */
  @Column({ name: 'metadata', type: 'nvarchar', length: 'MAX', nullable: true })
  metadata!: string | null;
}
