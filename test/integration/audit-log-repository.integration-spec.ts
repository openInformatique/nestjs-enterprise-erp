import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { AuditCategory } from '../../src/modules/audit/domain/audit-category.enum';
import { AuditLogEntity } from '../../src/modules/audit/infrastructure/entities/audit-log.entity';
import { TypeOrmAuditLogRepository } from '../../src/modules/audit/infrastructure/typeorm-audit-log.repository';
import { createTestDataSource } from '../helpers/test-database';

describe('TypeOrmAuditLogRepository (intégration)', () => {
  let dataSource: DataSource;
  let entityRepository: Repository<AuditLogEntity>;
  let repository: TypeOrmAuditLogRepository;
  const createdActions: string[] = [];

  const uniqueAction = (): string => {
    const action = `it.audit.${randomUUID()}`;
    createdActions.push(action);
    return action;
  };

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    entityRepository = dataSource.getRepository(AuditLogEntity);
    repository = new TypeOrmAuditLogRepository(entityRepository);
  });

  afterAll(async () => {
    if (createdActions.length > 0) {
      await entityRepository
        .createQueryBuilder()
        .delete()
        .where('action IN (:...actions)', { actions: createdActions })
        .execute();
    }
    await dataSource.destroy();
  });

  it('persiste un audit complet avec métadonnées JSON', async () => {
    const action = uniqueAction();

    await repository.insert({
      category: AuditCategory.Security,
      action,
      actorUserId: null,
      resourceType: 'auth_session',
      resourceId: 'session-42',
      requestId: 'req-42',
      ipAddress: '10.0.0.1',
      userAgent: 'integration-test',
      metadata: JSON.stringify({ detail: 'valeur' }),
    });

    const stored = await entityRepository.findOne({ where: { action } });
    expect(stored).not.toBeNull();
    expect(stored!.category).toBe(AuditCategory.Security);
    expect(stored!.requestId).toBe('req-42');
    expect(stored!.createdAt).toBeInstanceOf(Date);
    expect(JSON.parse(stored!.metadata!)).toEqual({ detail: 'valeur' });
  });

  it('persiste un audit minimal (tous les champs optionnels null)', async () => {
    const action = uniqueAction();

    await repository.insert({
      category: AuditCategory.Technical,
      action,
    });

    const stored = await entityRepository.findOne({ where: { action } });
    expect(stored).not.toBeNull();
    expect(stored!.actorUserId).toBeNull();
    expect(stored!.metadata).toBeNull();
  });
});
