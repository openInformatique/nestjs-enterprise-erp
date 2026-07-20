import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { AuditLog } from '../domain/audit-log';
import {
  AUDIT_LOG_REPOSITORY,
  ListAuditLogsQuery,
} from '../domain/audit-log-repository.port';
import type { AuditLogRepositoryPort } from '../domain/audit-log-repository.port';

/** Cas d'utilisation : lister le journal d'audit (pagination + filtres). */
@Injectable()
export class ListAuditLogsUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  execute(query: ListAuditLogsQuery): Promise<PaginatedResult<AuditLog>> {
    return this.auditLogRepository.findAll(query);
  }
}
