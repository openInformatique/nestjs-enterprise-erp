import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  createE2eApplication,
  createE2eTestUser,
  E2eTestUser,
} from '../helpers/e2e-app';

/**
 * Tests end-to-end des endpoints de démonstration technique :
 * génération PDF, dépôt / téléchargement / suppression de fichiers,
 * envoi d'e-mail (driver development en environnement de test).
 */
describe('Démonstration technique (e2e)', () => {
  let app: NestExpressApplication;
  let user: E2eTestUser;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let accessToken: string;

  beforeAll(async () => {
    app = await createE2eApplication();
    server = app.getHttpServer();
    user = await createE2eTestUser(app);

    const loginResponse = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
    accessToken = loginResponse.body.data.accessToken as string;
  });

  afterAll(async () => {
    await user.cleanup();
    await app.close();
  });

  const authorized = () => `Bearer ${accessToken}`;

  describe('PDF', () => {
    it('exige une authentification', async () => {
      await request(server).get('/api/v1/technical-demo/pdf').expect(401);
    });

    it('renvoie un PDF téléchargeable, hors enveloppe JSON', async () => {
      const response = await request(server)
        .get('/api/v1/technical-demo/pdf')
        .set('Authorization', authorized())
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');

      const content = response.body as Buffer;
      expect(content.length).toBeGreaterThan(500);
      // Signature PDF valide.
      expect(content.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  describe('fichiers', () => {
    it('téléverse, télécharge puis supprime un fichier', async () => {
      // 1. Dépôt.
      const uploadResponse = await request(server)
        .post('/api/v1/technical-demo/files')
        .set('Authorization', authorized())
        .attach('file', Buffer.from('contenu du fichier e2e'), {
          filename: 'test-e2e.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      expect(uploadResponse.body.success).toBe(true);
      const identifier = uploadResponse.body.data.identifier as string;
      expect(uploadResponse.body.data.originalName).toBe('test-e2e.txt');

      // 2. Téléchargement : contenu brut, hors enveloppe.
      const downloadResponse = await request(server)
        .get(`/api/v1/technical-demo/files/${identifier}`)
        .set('Authorization', authorized())
        .expect(200);

      expect(downloadResponse.headers['content-type']).toContain('text/plain');
      expect(downloadResponse.text ?? downloadResponse.body.toString()).toBe(
        'contenu du fichier e2e',
      );

      // 3. Suppression puis 404 sur relecture.
      await request(server)
        .delete(`/api/v1/technical-demo/files/${identifier}`)
        .set('Authorization', authorized())
        .expect(204);

      const notFoundResponse = await request(server)
        .get(`/api/v1/technical-demo/files/${identifier}`)
        .set('Authorization', authorized())
        .expect(404);
      expect(notFoundResponse.body.error.code).toBe('FILE_NOT_FOUND');
    });

    it('refuse un type MIME non autorisé', async () => {
      const response = await request(server)
        .post('/api/v1/technical-demo/files')
        .set('Authorization', authorized())
        .attach('file', Buffer.from('MZ...'), {
          filename: 'virus.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(400);

      expect(response.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
    });
  });

  describe('e-mail', () => {
    it('envoie un e-mail de démonstration via le driver development', async () => {
      const response = await request(server)
        .post('/api/v1/technical-demo/mail')
        .set('Authorization', authorized())
        .send({ recipient: 'destinataire@example.com' })
        .expect(200);

      expect(response.body.data.delivered).toBe(true);
      expect(response.body.data.messageId).toMatch(/^dev-/);
    });

    it('valide l’adresse du destinataire', async () => {
      const response = await request(server)
        .post('/api/v1/technical-demo/mail')
        .set('Authorization', authorized())
        .send({ recipient: 'pas-un-email' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
