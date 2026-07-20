import { RequestContextService } from '../../../common/context/request-context.service';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { AuditService } from '../../audit/application/audit.service';
import { AuthSession, SessionRevocationReason } from '../domain/auth-session';
import { AuthSessionRepositoryPort } from '../domain/auth-session-repository.port';
import { RevokeSessionUseCase } from './revoke-session.use-case';

const buildSession = (
  userId: string,
  revokedAt: Date | null = null,
): AuthSession =>
  new AuthSession(
    'session-1',
    userId,
    'hash',
    'family-1',
    null,
    null,
    null,
    new Date(Date.now() + 86_400_000),
    revokedAt,
    null,
    new Date(),
  );

describe('RevokeSessionUseCase', () => {
  let revokeCalls: Array<{ sessionId: string; reason: string }>;
  let session: AuthSession | null;
  let useCase: RevokeSessionUseCase;

  beforeEach(() => {
    revokeCalls = [];
    session = null;
    const repository = {
      findById: () => Promise.resolve(session),
      revoke: (sessionId: string, reason: string) => {
        revokeCalls.push({ sessionId, reason });
        return Promise.resolve();
      },
    } as unknown as AuthSessionRepositoryPort;
    const auditService = new AuditService(
      { insert: () => Promise.resolve() },
      new RequestContextService(),
    );
    useCase = new RevokeSessionUseCase(repository, auditService);
  });

  it("révoque une session appartenant à l'utilisateur", async () => {
    session = buildSession('user-1');

    await useCase.execute('user-1', 'session-1');

    expect(revokeCalls).toEqual([
      {
        sessionId: 'session-1',
        reason: SessionRevocationReason.RevokedByUser,
      },
    ]);
  });

  it("répond RESOURCE_NOT_FOUND pour la session d'un autre utilisateur", async () => {
    session = buildSession('autre-utilisateur');

    await expect(useCase.execute('user-1', 'session-1')).rejects.toThrow(
      ResourceNotFoundException,
    );
    expect(revokeCalls).toHaveLength(0);
  });

  it('répond RESOURCE_NOT_FOUND pour une session inexistante', async () => {
    await expect(useCase.execute('user-1', 'session-x')).rejects.toThrow(
      ResourceNotFoundException,
    );
  });

  it('est idempotent sur une session déjà révoquée', async () => {
    session = buildSession('user-1', new Date());

    await expect(
      useCase.execute('user-1', 'session-1'),
    ).resolves.toBeUndefined();
    expect(revokeCalls).toHaveLength(0);
  });
});
