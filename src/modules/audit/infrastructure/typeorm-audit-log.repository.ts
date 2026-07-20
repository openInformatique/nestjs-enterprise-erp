import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { AuditLog } from '../domain/audit-log';
import {
  AuditLogRecord,
  AuditLogRepositoryPort,
  ListAuditLogsQuery,
} from '../domain/audit-log-repository.port';
import { AuditLogEntity } from './entities/audit-log.entity';

/**
 * Implémentation TypeORM du repository d'audit.
 *
 * Insertion uniquement : le journal d'audit est immuable, aucune méthode
 * de mise à jour ou de suppression n'existe.
 */
@Injectable()
export class TypeOrmAuditLogRepository implements AuditLogRepositoryPort {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
  ) {}

  async insert(record: AuditLogRecord): Promise<void> {
    await this.repository.insert(
      this.repository.create({
        category: record.category,
        action: record.action,
        actorUserId: record.actorUserId ?? null,
        resourceType: record.resourceType ?? null,
        resourceId: record.resourceId ?? null,
        requestId: record.requestId ?? null,
        ipAddress: record.ipAddress ?? null,
        userAgent: record.userAgent ?? null,
        metadata: record.metadata ?? null,
      }),
    );
  }

  async findAll(query: ListAuditLogsQuery): Promise<PaginatedResult<AuditLog>> {
    const queryBuilder = this.repository.createQueryBuilder('log');

    if (query.resourceType !== undefined) {
      queryBuilder.andWhere('log.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    }
    if (query.resourceId !== undefined) {
      queryBuilder.andWhere('log.resourceId = :resourceId', {
        resourceId: query.resourceId,
      });
    }
    if (query.actorUserId !== undefined) {
      queryBuilder.andWhere('log.actorUserId = :actorUserId', {
        actorUserId: query.actorUserId,
      });
    }
    if (query.action !== undefined) {
      queryBuilder.andWhere('log.action = :action', { action: query.action });
    }
    if (query.category !== undefined) {
      queryBuilder.andWhere('log.category = :category', {
        category: query.category,
      });
    }
    if (query.from !== undefined) {
      queryBuilder.andWhere('log.createdAt >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('log.createdAt <= :to', { to: query.to });
    }

    queryBuilder.orderBy('log.createdAt', query.sortDirection);

    const result = await TypeOrmPaginationHelper.paginate(
      queryBuilder,
      query.page,
      query.limit,
    );

    return {
      items: result.items.map(
        (entity) =>
          new AuditLog(
            entity.id,
            entity.category,
            entity.action,
            entity.actorUserId,
            entity.resourceType,
            entity.resourceId,
            entity.requestId,
            entity.ipAddress,
            entity.metadata,
            entity.createdAt,
          ),
      ),
      meta: result.meta,
    };
  }
}
