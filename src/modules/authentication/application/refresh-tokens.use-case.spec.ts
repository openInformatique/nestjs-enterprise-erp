import { JwtService } from '@nestjs/jwt';
import { RequestContextService } from '../../../common/context/request-context.service';
import {
  RefreshTokenInvalidException,
  RefreshTokenReuseDetectedException,
  SessionExpiredException,
  SessionRevokedException,
} from '../../../common/exceptions/app-exceptions';
import { SameSitePolicy } from '../../../config/environment.validation';
import { AuditService } from '../../audit/application/audit.service';
import { AuditLogRecord } from '../../audit/domain/audit-log-repository.port';
import { AuthSession, SessionRevocationReason } from '../domain/auth-session';
import { AuthSessionRepositoryPort } from '../domain/auth-session-repository.port';
import { RefreshTokensUseCase } from './refresh-tokens.use-case';
import { TokenService } from './token.service';

const tokenService = new TokenService(new JwtService({}), {
  accessTokenSecret: 'secret-access-de-test-suffisamment-long-123456',
  accessTokenExpiration: '15m',
  refreshTokenSecret: 'secret-refresh-de-test-suffisamment-long-123456',
  refreshTokenExpiration: '7d',
  refreshCookie: {
    name: 'refresh_token',
    secure: false,
    sameSite: SameSitePolicy.Lax,
    domain: undefined,
  },
});

/** Double de test du repository de sessions, en mémoire. */
class InMemorySessionRepository implements AuthSessionRepositoryPort {
  sessions = new Map<string, AuthSession>();
  revokedFamilies: string[] = [];
  rotations: Array<{ sessionId: string; newHash: string }> = [];

  create(): Promise<AuthSession> {
    throw new Error('non utilisé dans ces tests');
  }
  findById(id: string): Promise<AuthSession | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }
  findActiveByUserId(): Promise<AuthSession[]> {
    return Promise.resolve([]);
  }
  rotateRefreshToken(sessionId: string, newHash: string): Promise<void> {
    this.rotations.push({ sessionId, newHash });
    return Promise.resolve();
  }
  revoke(): Promise<void> {
    return Promise.resolve();
  }
  revokeFamily(tokenFamilyId: string): Promise<number> {
    this.revokedFamilies.push(tokenFamilyId);
    return Promise.resolve(2);
  }
  revokeAllForUser(): Promise<number> {
    return Promise.resolve(0);
  }
  deleteExpiredBefore(): Promise<number> {
    return Promise.resolve(0);
  }
}

const buildSession = (
  refreshTokenHash: string,
  overrides: { revokedAt?: Date | null; expiresAt?: Date } = {},
): AuthSession =>
  new AuthSession(
    'session-1',
    'user-1',
    refreshTokenHash,
    'family-1',
    null,
    null,
    null,
    overrides.expiresAt ?? new Date(Date.now() + 86_400_000),
    overrides.revokedAt ?? null,
    overrides.revokedAt ? SessionRevocationReason.Logout : null,
    new Date(),
  );

describe('RefreshTokensUseCase', () => {
  let repository: InMemorySessionRepository;
  let auditedActions: string[];
  let useCase: RefreshTokensUseCase;

  beforeEach(() => {
    repository = new InMemorySessionRepository();
    auditedActions = [];
    const auditService = new AuditService(
      {
        insert: (record: AuditLogRecord) => {
          auditedActions.push(record.action);
          return Promise.resolve();
        },
      },
      new RequestContextService(),
    );
    useCase = new RefreshTokensUseCase(repository, tokenService, auditService);
  });

  it('effectue la rotation avec un refresh token valide', async () => {
    const refresh = await tokenService.generateRefreshToken(
      'user-1',
      'session-1',
    );
    repository.sessions.set(
      'session-1',
      buildSession(tokenService.hashRefreshToken(refresh.token)),
    );

    const result = await useCase.execute(refresh.token);

    // Nouveau refresh token : différent, et l'empreinte stockée a changé.
    expect(result.refreshToken.token).not.toBe(refresh.token);
    expect(repository.rotations).toHaveLength(1);
    expect(repository.rotations[0]!.newHash).toBe(
      tokenService.hashRefreshToken(result.refreshToken.token),
    );
    // Nouvel access token vérifiable.
    await expect(
      tokenService.verifyAccessToken(result.accessToken.token),
    ).resolves.toMatchObject({ sub: 'user-1', sid: 'session-1' });
    expect(auditedActions).toContain('auth.token.refreshed');
  });

  it("détecte la réutilisation d'un ancien token et révoque la famille", async () => {
    const oldToken = await tokenService.generateRefreshToken(
      'user-1',
      'session-1',
    );
    // La session stocke l'empreinte d'un AUTRE token (rotation passée).
    repository.sessions.set(
      'session-1',
      buildSession(tokenService.hashRefreshToken('token-plus-recent')),
    );

    await expect(useCase.execute(oldToken.token)).rejects.toThrow(
      RefreshTokenReuseDetectedException,
    );
    expect(repository.revokedFamilies).toEqual(['family-1']);
    expect(auditedActions).toContain('auth.refresh-token.reuse-detected');
    expect(repository.rotations).toHaveLength(0);
  });

  it('refuse une session révoquée (token courant présenté)', async () => {
    const refresh = await tokenService.generateRefreshToken(
      'user-1',
      'session-1',
    );
    repository.sessions.set(
      'session-1',
      buildSession(tokenService.hashRefreshToken(refresh.token), {
        revokedAt: new Date(),
      }),
    );

    await expect(useCase.execute(refresh.token)).rejects.toThrow(
      SessionRevokedException,
    );
    expect(repository.revokedFamilies).toHaveLength(0);
  });

  it('refuse une session expirée', async () => {
    const refresh = await tokenService.generateRefreshToken(
      'user-1',
      'session-1',
    );
    repository.sessions.set(
      'session-1',
      buildSession(tokenService.hashRefreshToken(refresh.token), {
        expiresAt: new Date(Date.now() - 1000),
      }),
    );

    await expect(useCase.execute(refresh.token)).rejects.toThrow(
      SessionExpiredException,
    );
  });

  it('refuse un token dont la session est introuvable', async () => {
    const refresh = await tokenService.generateRefreshToken(
      'user-1',
      'session-inconnue',
    );

    await expect(useCase.execute(refresh.token)).rejects.toThrow(
      RefreshTokenInvalidException,
    );
  });

  it('refuse un token signé avec un autre secret', async () => {
    const foreignService = new TokenService(new JwtService({}), {
      accessTokenSecret: 'autre-secret-access-suffisamment-long-999999',
      accessTokenExpiration: '15m',
      refreshTokenSecret: 'autre-secret-refresh-suffisamment-long-999999',
      refreshTokenExpiration: '7d',
      refreshCookie: {
        name: 'refresh_token',
        secure: false,
        sameSite: SameSitePolicy.Lax,
        domain: undefined,
      },
    });
    const forged = await foreignService.generateRefreshToken(
      'user-1',
      'session-1',
    );

    await expect(useCase.execute(forged.token)).rejects.toThrow(
      RefreshTokenInvalidException,
    );
  });
});
