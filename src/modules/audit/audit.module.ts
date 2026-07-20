import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './application/audit.service';
import { ListAuditLogsUseCase } from './application/list-audit-logs.use-case';
import { AUDIT_LOG_REPOSITORY } from './domain/audit-log-repository.port';
import { AuditLogEntity } from './infrastructure/entities/audit-log.entity';
import { TypeOrmAuditLogRepository } from './infrastructure/typeorm-audit-log.repository';
import { AuditController } from './presentation/audit.controller';

/**
 * Module du journal d'audit persistant.
 *
 * Distinct des logs techniques Pino : il conserve en base les événements
 * significatifs (sécurité, technique, métier). Les autres modules
 * consomment AuditService pour déclarer leurs événements explicitement.
 *
 * AuditController expose le journal en LECTURE SEULE (GET /audit-logs,
 * ADMIN) : immuable ne veut pas dire invisible. ListAuditLogsUseCase
 * est exporté pour les endpoints « :id/history » des autres modules
 * (module 10).
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  controllers: [AuditController],
  providers: [
    AuditService,
    ListAuditLogsUseCase,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: TypeOrmAuditLogRepository,
    },
  ],
  exports: [AuditService, ListAuditLogsUseCase],
})
export class AuditModule {}
