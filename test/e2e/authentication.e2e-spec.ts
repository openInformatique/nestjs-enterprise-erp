import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  createE2eApplication,
  createE2eTestUser,
  E2eTestUser,
  extractRefreshCookie,
} from '../helpers/e2e-app';

/**
 * Scénario end-to-end du cycle d'authentification complet :
 * login, accès protégé, profil, sessions, rotation des refresh tokens,
 * détection de réutilisation, révocation, logout, formats de réponse.
 */
describe('Authentification (e2e)', () => {
  let app: NestExpressApplication;
  let user: E2eTestUser;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createE2eApplication();
    server = app.getHttpServer();
    user = await createE2eTestUser(app);
  });

  afterAll(async () => {
    await user.cleanup();
    await app.close();
  });

  const login = () =>
    request(server)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password });

  describe('login', () => {
    it('accepte des identifiants valides et applique le format standard', async () => {
      const response = await login().expect(200);

      // Enveloppe standardisée.
      expect(response.body).toMatchObject({ success: true });
      expect(response.body.meta.requestId).toBeDefined();
      expect(response.body.meta.timestamp).toBeDefined();

      // Access token dans le corps, refresh token UNIQUEMENT en cookie.
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.email).toBe(user.email);
      expect(JSON.stringify(response.body)).not.toContain('refreshToken');

      const cookie = extractRefreshCookie(response.headers);
      expect(cookie).toBeDefined();

      // Attributs de sécurité du cookie.
      const rawCookie = (
        response.headers['set-cookie'] as unknown as string[]
      ).find((value) => value.startsWith('refresh_token='))!;
      expect(rawCookie).toContain('HttpOnly');
      expect(rawCookie).toContain('Path=/api/v1/auth');
      expect(rawCookie).toContain('SameSite=Lax');

      // En-tête de corrélation.
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('refuse des identifiants invalides avec un message générique', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'mauvais-mot-de-passe' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Identifiants incorrects.',
        },
      });
      expect(response.body.meta.path).toBe('/api/v1/auth/login');
    });

    it('valide le DTO : e-mail invalide → VALIDATION_ERROR avec détails', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'pas-un-email', password: 'x' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
      );
    });

    it('rejette les propriétés non déclarées (whitelist stricte)', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password, admin: true })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('routes protégées', () => {
    it('refuse l’accès sans jeton', async () => {
      const response = await request(server).get('/api/v1/auth/me').expect(401);

      expect(response.body.error.code).toBe('ACCESS_TOKEN_INVALID');
    });

    it('refuse un jeton falsifié', async () => {
      await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer jeton.falsifie.xxx')
        .expect(401);
    });

    it('renvoie le profil avec un jeton valide', async () => {
      const loginResponse = await login().expect(200);
      const accessToken = loginResponse.body.data.accessToken as string;

      const response = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: user.id,
        email: user.email,
        displayName: 'Utilisateur e2e',
      });
      // Aucune donnée sensible dans le profil.
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it('liste les sessions actives avec la session courante marquée', async () => {
      const loginResponse = await login().expect(200);
      const accessToken = loginResponse.body.data.accessToken as string;

      const response = await request(server)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const sessions = response.body.data as Array<{
        id: string;
        isCurrent: boolean;
      }>;
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions.filter((session) => session.isCurrent)).toHaveLength(1);
      // Le hash du refresh token ne fuit jamais.
      expect(JSON.stringify(response.body)).not.toContain('refreshTokenHash');
    });
  });

  describe('rotation des refresh tokens', () => {
    it('rafraîchit les jetons et remplace le cookie', async () => {
      const loginResponse = await login().expect(200);
      const initialCookie = extractRefreshCookie(loginResponse.headers)!;
      const initialAccessToken = loginResponse.body.data.accessToken as string;

      const refreshResponse = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialCookie)
        .expect(200);

      // Nouvel access token et nouveau cookie (rotation).
      expect(refreshResponse.body.data.accessToken).toBeDefined();
      expect(refreshResponse.body.data.accessToken).not.toBe(
        initialAccessToken,
      );
      const rotatedCookie = extractRefreshCookie(refreshResponse.headers)!;
      expect(rotatedCookie).not.toBe(initialCookie);

      // Le nouveau cookie fonctionne à son tour.
      await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', rotatedCookie)
        .expect(200);
    });

    it('refuse un refresh sans cookie', async () => {
      const response = await request(server)
        .post('/api/v1/auth/refresh')
        .expect(401);

      expect(response.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('détecte la réutilisation d’un ancien token et révoque la famille', async () => {
      const loginResponse = await login().expect(200);
      const oldCookie = extractRefreshCookie(loginResponse.headers)!;

      // Rotation : oldCookie devient obsolète.
      const refreshResponse = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', oldCookie)
        .expect(200);
      const currentCookie = extractRefreshCookie(refreshResponse.headers)!;

      // Rejouer l'ANCIEN token : compromission présumée.
      const reuseResponse = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', oldCookie)
        .expect(401);
      expect(reuseResponse.body.error.code).toBe(
        'REFRESH_TOKEN_REUSE_DETECTED',
      );

      // Toute la famille est révoquée : le token COURANT est refusé aussi.
      const revokedResponse = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', currentCookie)
        .expect(401);
      expect(revokedResponse.body.error.code).toBe('SESSION_REVOKED');
    });
  });

  describe('révocation et déconnexion', () => {
    it('révoque une session précise de l’utilisateur', async () => {
      // Deux sessions : une « pilote » et une « cible ».
      const pilot = await login().expect(200);
      const pilotToken = pilot.body.data.accessToken as string;
      const target = await login().expect(200);
      const targetCookie = extractRefreshCookie(target.headers)!;

      const sessions = await request(server)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${pilotToken}`)
        .expect(200);
      const targetSession = (
        sessions.body.data as Array<{ id: string; isCurrent: boolean }>
      ).find((session) => !session.isCurrent);

      await request(server)
        .delete(`/api/v1/auth/sessions/${targetSession!.id}`)
        .set('Authorization', `Bearer ${pilotToken}`)
        .expect(204);

      // La session révoquée ne peut plus rafraîchir.
      const refreshAfterRevoke = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', targetCookie);
      expect([401]).toContain(refreshAfterRevoke.status);
    });

    it('logout révoque la session courante et vide le cookie', async () => {
      const loginResponse = await login().expect(200);
      const accessToken = loginResponse.body.data.accessToken as string;
      const cookie = extractRefreshCookie(loginResponse.headers)!;

      const logoutResponse = await request(server)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Le cookie est supprimé (valeur vide).
      const clearedCookie = (
        logoutResponse.headers['set-cookie'] as unknown as string[]
      ).find((value) => value.startsWith('refresh_token='));
      expect(clearedCookie).toContain('refresh_token=;');

      // Le refresh token de la session déconnectée est refusé.
      const refreshResponse = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
      expect(refreshResponse.body.error.code).toBe('SESSION_REVOKED');
    });

    it('logout-all révoque toutes les sessions', async () => {
      const first = await login().expect(200);
      const firstCookie = extractRefreshCookie(first.headers)!;
      const second = await login().expect(200);
      const secondToken = second.body.data.accessToken as string;
      const secondCookie = extractRefreshCookie(second.headers)!;

      const response = await request(server)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(200);

      expect(response.body.data.revokedSessions).toBeGreaterThanOrEqual(2);

      // Plus aucun refresh token de l'utilisateur ne fonctionne.
      for (const cookie of [firstCookie, secondCookie]) {
        const refreshResponse = await request(server)
          .post('/api/v1/auth/refresh')
          .set('Cookie', cookie)
          .expect(401);
        expect(refreshResponse.body.error.code).toBe('SESSION_REVOKED');
      }
    });
  });

  describe('santé', () => {
    it('les endpoints de santé sont publics', async () => {
      const health = await request(server).get('/api/v1/health').expect(200);
      expect(health.body.data.status).toBe('ok');

      await request(server).get('/api/v1/health/live').expect(200);
      await request(server).get('/api/v1/health/ready').expect(200);
    });

    it("la santé n'expose ni secret ni chaîne de connexion", async () => {
      const response = await request(server).get('/api/v1/health').expect(200);
      const body = JSON.stringify(response.body);

      expect(body).not.toContain(process.env.DB_PASSWORD as string);
      expect(body).not.toContain('password');
      expect(body).not.toContain('connectionString');
    });
  });
});
