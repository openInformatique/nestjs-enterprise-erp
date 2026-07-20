import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { SessionRevocationReason } from '../../src/modules/authentication/domain/auth-session';
import { AuthSessionEntity } from '../../src/modules/authentication/infrastructure/entities/auth-session.entity';
import { AuthSessionMapper } from '../../src/modules/authentication/infrastructure/auth-session.mapper';
import { TypeOrmAuthSessionRepository } from '../../src/modules/authentication/infrastructure/typeorm-auth-session.repository';
import { AuthenticationSource } from '../../src/modules/users/domain/authentication-source.enum';
import { UserEntity } from '../../src/modules/users/infrastructure/entities/user.entity';
import { createTestDataSource } from '../helpers/test-database';

describe('TypeOrmAuthSessionRepository (intégration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<UserEntity>;
  let sessionEntityRepository: Repository<AuthSessionEntity>;
  let repository: TypeOrmAuthSessionRepository;
  let testUser: UserEntity;

  const futureDate = (): Date => new Date(Date.now() + 86_400_000);

  const createSession = async (
    overrides: {
      tokenFamilyId?: string;
      expiresAt?: Date;
    } = {},
  ) =>
    repository.create({
      sessionId: randomUUID(),
      userId: testUser.id,
      refreshTokenHash: `hash-${randomUUID()}`,
      tokenFamilyId: overrides.tokenFamilyId ?? randomUUID(),
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      expiresAt: overrides.expiresAt ?? futureDate(),
    });

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    userRepository = dataSource.getRepository(UserEntity);
    sessionEntityRepository = dataSource.getRepository(AuthSessionEntity);
    repository = new TypeOrmAuthSessionRepository(
      sessionEntityRepository,
      new AuthSessionMapper(),
    );

    testUser = await userRepository.save(
      userRepository.create({
        email: `it-session-${randomUUID()}@test.dev`,
        displayName: 'Utilisateur sessions',
        passwordHash: 'hash',
        authenticationSource: AuthenticationSource.Local,
        isActive: true,
      }),
    );
  });

  afterAll(async () => {
    // Nettoyage : sessions de l'utilisateur de test puis l'utilisateur.
    await sessionEntityRepository.delete({ userId: testUser.id });
    await userRepository.delete({ id: testUser.id });
    await dataSource.destroy();
  });

  it('crée une session avec l’identifiant fourni par le cas d’utilisation', async () => {
    const sessionId = randomUUID();
    const created = await repository.create({
      sessionId,
      userId: testUser.id,
      refreshTokenHash: 'hash-initial',
      tokenFamilyId: randomUUID(),
      userAgent: null,
      ipAddress: null,
      expiresAt: futureDate(),
    });

    expect(created.id.toLowerCase()).toBe(sessionId.toLowerCase());
    expect(created.refreshTokenHash).toBe('hash-initial');
    expect(created.isUsable()).toBe(true);
  });

  it('effectue la rotation de l’empreinte du refresh token', async () => {
    const session = await createSession();
    const usedAt = new Date();

    await repository.rotateRefreshToken(session.id, 'nouveau-hash', usedAt);

    const reloaded = await repository.findById(session.id);
    expect(reloaded!.refreshTokenHash).toBe('nouveau-hash');
    expect(reloaded!.lastUsedAt).toBeInstanceOf(Date);
  });

  it('révoque une session précise', async () => {
    const session = await createSession();

    await repository.revoke(
      session.id,
      SessionRevocationReason.Logout,
      new Date(),
    );

    const reloaded = await repository.findById(session.id);
    expect(reloaded!.isRevoked()).toBe(true);
    expect(reloaded!.revocationReason).toBe(SessionRevocationReason.Logout);
    expect(reloaded!.isUsable()).toBe(false);
  });

  it('révoque toute une famille de tokens sans toucher aux autres', async () => {
    const family = randomUUID();
    const inFamily1 = await createSession({ tokenFamilyId: family });
    const inFamily2 = await createSession({ tokenFamilyId: family });
    const outsider = await createSession();

    const revokedCount = await repository.revokeFamily(
      family,
      SessionRevocationReason.TokenReuseDetected,
      new Date(),
    );

    expect(revokedCount).toBe(2);
    expect((await repository.findById(inFamily1.id))!.isRevoked()).toBe(true);
    expect((await repository.findById(inFamily2.id))!.isRevoked()).toBe(true);
    expect((await repository.findById(outsider.id))!.isRevoked()).toBe(false);
  });

  it('liste uniquement les sessions actives de l’utilisateur', async () => {
    const active = await createSession();
    const revoked = await createSession();
    await repository.revoke(
      revoked.id,
      SessionRevocationReason.Logout,
      new Date(),
    );
    const expired = await createSession({
      expiresAt: new Date(Date.now() - 1000),
    });

    const activeSessions = await repository.findActiveByUserId(testUser.id);
    const activeIds = activeSessions.map((session) => session.id);

    expect(activeIds).toContain(active.id);
    expect(activeIds).not.toContain(revoked.id);
    expect(activeIds).not.toContain(expired.id);
  });

  it('purge les sessions expirées avant un seuil', async () => {
    const oldExpired = await createSession({
      expiresAt: new Date(Date.now() - 30 * 86_400_000),
    });
    const stillValid = await createSession();

    const deletedCount = await repository.deleteExpiredBefore(
      new Date(Date.now() - 7 * 86_400_000),
    );

    expect(deletedCount).toBeGreaterThanOrEqual(1);
    await expect(repository.findById(oldExpired.id)).resolves.toBeNull();
    await expect(repository.findById(stillValid.id)).resolves.not.toBeNull();
  });
});
