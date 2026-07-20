import { JwtService } from '@nestjs/jwt';
import {
  AccessTokenInvalidException,
  RefreshTokenInvalidException,
} from '../../../common/exceptions/app-exceptions';
import { SameSitePolicy } from '../../../config/environment.validation';
import { TokenService } from './token.service';

const buildService = (): TokenService =>
  new TokenService(new JwtService({}), {
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

describe('TokenService', () => {
  const service = buildService();

  it('génère un access token vérifiable portant sub, sid, jti, iat et exp', async () => {
    const generated = await service.generateAccessToken('user-1', 'session-1');

    const payload = await service.verifyAccessToken(generated.token);
    expect(payload.sub).toBe('user-1');
    expect(payload.sid).toBe('session-1');
    expect(payload.jti).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
    // ~15 minutes d'écart entre émission et expiration.
    expect(payload.exp - payload.iat).toBe(15 * 60);
    expect(generated.expiresAt.getTime()).toBe(payload.exp * 1000);
  });

  it('les secrets access et refresh sont bien distincts', async () => {
    const refresh = await service.generateRefreshToken('user-1', 'session-1');

    // Un refresh token ne doit jamais passer la vérification access.
    await expect(service.verifyAccessToken(refresh.token)).rejects.toThrow(
      AccessTokenInvalidException,
    );
    await expect(
      service.verifyRefreshToken(refresh.token),
    ).resolves.toMatchObject({ sub: 'user-1' });
  });

  it('rejette un jeton falsifié', async () => {
    await expect(service.verifyAccessToken('jeton.invalide.x')).rejects.toThrow(
      AccessTokenInvalidException,
    );
    await expect(
      service.verifyRefreshToken('jeton.invalide.x'),
    ).rejects.toThrow(RefreshTokenInvalidException);
  });

  it('produit une empreinte SHA-256 déterministe et distincte du jeton', () => {
    const hash1 = service.hashRefreshToken('mon-token');
    const hash2 = service.hashRefreshToken('mon-token');
    const hash3 = service.hashRefreshToken('autre-token');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).not.toContain('mon-token');
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });
});
