import { RequestContextService } from '../../../common/context/request-context.service';
import { AuditCategory } from '../domain/audit-category.enum';
import {
  AuditLogRecord,
  AuditLogRepositoryPort,
} from '../domain/audit-log-repository.port';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let contextService: RequestContextService;
  let insertedRecords: AuditLogRecord[];
  let repository: AuditLogRepositoryPort;

  beforeEach(() => {
    insertedRecords = [];
    repository = {
      insert: (record: AuditLogRecord) => {
        insertedRecords.push(record);
        return Promise.resolve();
      },
    };
    contextService = new RequestContextService();
    service = new AuditService(repository, contextService);
  });

  it('enregistre un événement avec les informations du contexte de requête', async () => {
    await contextService.run(
      {
        requestId: 'req-42',
        userId: 'user-7',
        ipAddress: '10.0.0.1',
        userAgent: 'jest',
        startedAt: new Date(),
      },
      async () => {
        await service.record({
          category: AuditCategory.Security,
          action: 'auth.login.success',
        });
      },
    );

    expect(insertedRecords).toHaveLength(1);
    expect(insertedRecords[0]).toMatchObject({
      category: AuditCategory.Security,
      action: 'auth.login.success',
      actorUserId: 'user-7',
      requestId: 'req-42',
      ipAddress: '10.0.0.1',
      userAgent: 'jest',
    });
  });

  it('fonctionne hors requête HTTP (cron, script) avec des champs null', async () => {
    await service.record({
      category: AuditCategory.Technical,
      action: 'scheduler.cleanup.completed',
    });

    expect(insertedRecords[0]).toMatchObject({
      actorUserId: null,
      requestId: null,
      ipAddress: null,
    });
  });

  it("privilégie l'acteur explicite sur celui du contexte", async () => {
    await contextService.run(
      { requestId: 'req-1', userId: 'user-du-contexte', startedAt: new Date() },
      async () => {
        await service.record({
          category: AuditCategory.Security,
          action: 'auth.session.revoked',
          actorUserId: 'acteur-explicite',
        });
      },
    );

    expect(insertedRecords[0]!.actorUserId).toBe('acteur-explicite');
  });

  it('filtre les valeurs sensibles des métadonnées, y compris imbriquées', async () => {
    await service.record({
      category: AuditCategory.Security,
      action: 'auth.login.failed',
      metadata: {
        email: 'user@local.dev',
        password: 'SuperSecret123!',
        refreshToken: 'jwt-refresh',
        nested: {
          authorizationHeader: 'Bearer xyz',
          note: 'valeur conservée',
        },
      },
    });

    const metadata = JSON.parse(insertedRecords[0]!.metadata!) as Record<
      string,
      unknown
    >;
    expect(metadata.email).toBe('user@local.dev');
    expect(metadata.password).toBe('[REDACTED]');
    expect(metadata.refreshToken).toBe('[REDACTED]');
    expect(
      (metadata.nested as Record<string, unknown>).authorizationHeader,
    ).toBe('[REDACTED]');
    expect((metadata.nested as Record<string, unknown>).note).toBe(
      'valeur conservée',
    );
  });

  it("n'interrompt pas le cas d'utilisation si l'insertion échoue", async () => {
    repository.insert = () => Promise.reject(new Error('base indisponible'));
    service = new AuditService(repository, contextService);

    await expect(
      service.record({
        category: AuditCategory.Security,
        action: 'auth.login.success',
      }),
    ).resolves.toBeUndefined();
  });
});
