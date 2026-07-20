import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { AuditCategory } from './audit-category.enum';
import { AuditLog } from './audit-log';

/** Données nécessaires à l'enregistrement d'un événement d'audit. */
export interface AuditLogRecord {
  category: AuditCategory;
  /** Action technique stable, ex. : auth.login.success */
  action: string;
  actorUserId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Métadonnées JSON déjà filtrées des valeurs sensibles. */
  metadata?: string | null;
}

/** Critères de listing du journal d'audit. */
export interface ListAuditLogsQuery {
  page: number;
  limit: number;
  /** Tri fixe sur createdAt : un journal se lit chronologiquement, pas
   *  par colonne libre — seule la DIRECTION est configurable. */
  sortDirection: SortDirection;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string;
  action?: string;
  category?: AuditCategory;
  from?: Date;
  to?: Date;
}

/**
 * Contrat de persistance du journal d'audit.
 *
 * Défini dans le domaine, implémenté par l'infrastructure (TypeORM).
 * Un audit log s'insère, ne se modifie jamais — findAll est la seule
 * capacité de LECTURE (module 10).
 */
export interface AuditLogRepositoryPort {
  insert(record: AuditLogRecord): Promise<void>;

  /** Liste paginée et filtrable — la première LECTURE du journal. */
  findAll(query: ListAuditLogsQuery): Promise<PaginatedResult<AuditLog>>;
}

/** Jeton d'injection du repository d'audit. */
export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
