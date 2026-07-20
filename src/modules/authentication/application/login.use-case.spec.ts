import { JwtService } from '@nestjs/jwt';
import { RequestContextService } from '../../../common/context/request-context.service';
import { AuthenticationFailedException } from '../../../common/exceptions/app-exceptions';
import { SameSitePolicy } from '../../../config/environment.validation';
import { AuditService } from '../../audit/application/audit.service';
import { AuditLogRecord } from '../../audit/domain/audit-log-repository.port';
import { UserRepositoryPort } from '../../users/domain/user-repository.port';
import { AuthSession } from '../domain/auth-session';
import {
  AuthSessionRepositoryPort,
  CreateAuthSessionInput,
} from '../domain/auth-session-repository.port';
import { IdentityProviderPort } from '../domain/identity-provider.port';
import { LoginUseCase } from './login.use-case';
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

describe('LoginUseCase', () => {
  let createdSessions: CreateAuthSessionInput[];
  let lastLoginUpdates: string[];
  let auditRecords: AuditLogRecord[];
  let useCase: LoginUseCase;

  const identityProvider: IdentityProviderPort = {
    authenticate: (input) => {
      if (
        input.type === 'local' &&
        input.email === 'admin@local.dev' &&
        input.password === 'bon-mot-de-passe'
      ) {
        return Promise.resolve({
          userId: 'user-1',
          email: 'admin@local.dev',
          displayName: 'Administrateur',
        });
      }
      return Promise.reject(new AuthenticationFailedException());
    },
  };

  beforeEach(() => {
    createdSessions = [];
    lastLoginUpdates = [];
    auditRecords = [];

    const sessionRepository = {
      create: (input: CreateAuthSessionInput) => {
        createdSessions.push(input);
        return Promise.resolve({} as AuthSession);
      },
    } as unknown as AuthSessionRepositoryPort;

    const userRepository = {
      findById: () => Promise.resolve(null),
      findByEmail: () => Promise.resolve(null),
      updateLastLoginAt: (id: string) => {
        lastLoginUpdates.push(id);
        return Promise.resolve();
      },
    } as UserRepositoryPort;

    const auditService = new AuditService(
      {
        insert: (record: AuditLogRecord) => {
          auditRecords.push(record);
          return Promise.resolve();
        },
      },
      new RequestContextService(),
    );

    useCase = new LoginUseCase(
      identityProvider,
      sessionRepository,
      userRepository,
      tokenService,
      auditService,
      new RequestContextService(),
    );
  });

  it('crée une session et des jetons cohérents en cas de succès', async () => {
    const result = await useCase.execute('admin@local.dev', 'bon-mot-de-passe');

    // Session créée avec l'empreinte du refresh token, jamais le token.
    expect(createdSessions).toHaveLength(1);
    const session = createdSessions[0]!;
    expect(session.userId).toBe('user-1');
    expect(session.refreshTokenHash).toBe(
      tokenService.hashRefreshToken(result.refreshToken.token),
    );
    expect(session.refreshTokenHash).not.toBe(result.refreshToken.token);

    // Les deux jetons portent le même identifiant de session.
    const accessPayload = await tokenService.verifyAccessToken(
      result.accessToken.token,
    );
    const refreshPayload = await tokenService.verifyRefreshToken(
      result.refreshToken.token,
    );
    expect(accessPayload.sid).toBe(session.sessionId);
    expect(refreshPayload.sid).toBe(session.sessionId);

    // last_login_at mis à jour et audit de sécurité enregistré.
    expect(lastLoginUpdates).toEqual(['user-1']);
    expect(auditRecords.map((record) => record.action)).toContain(
      'auth.login.success',
    );

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'admin@local.dev',
      displayName: 'Administrateur',
    });
  });

  it('audite l’échec et relaie l’exception générique', async () => {
    await expect(
      useCase.execute('admin@local.dev', 'mauvais-mot-de-passe'),
    ).rejects.toThrow(AuthenticationFailedException);

    expect(createdSessions).toHaveLength(0);
    expect(lastLoginUpdates).toHaveLength(0);

    const failureAudit = auditRecords.find(
      (record) => record.action === 'auth.login.failed',
    );
    expect(failureAudit).toBeDefined();
    // L'e-mail tenté est audité ; le mot de passe n'apparaît nulle part.
    expect(failureAudit!.metadata).toContain('admin@local.dev');
    expect(JSON.stringify(auditRecords)).not.toContain('mauvais-mot-de-passe');
  });
});
