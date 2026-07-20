import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { AuthenticationSource } from '../../src/modules/users/domain/authentication-source.enum';
import { UserEntity } from '../../src/modules/users/infrastructure/entities/user.entity';

/**
 * Démarre l'application complète pour les tests end-to-end.
 *
 * configureApp applique EXACTEMENT la même chaîne HTTP que le démarrage
 * réel : sécurité, validation, enveloppe, erreurs, versionnement.
 */
export async function createE2eApplication(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

/** Utilisateur de test créé directement en base. */
export interface E2eTestUser {
  id: string;
  email: string;
  password: string;
  cleanup: () => Promise<void>;
}

/**
 * Crée un utilisateur actif avec mot de passe connu, et renvoie une
 * fonction de nettoyage (suppression physique, sessions comprises).
 */
export async function createE2eTestUser(
  app: NestExpressApplication,
): Promise<E2eTestUser> {
  const dataSource = app.get(DataSource);
  const repository = dataSource.getRepository(UserEntity);

  const email = `e2e-${randomUUID()}@test.dev`;
  const password = `E2e!${randomUUID()}`;

  const entity = await repository.save(
    repository.create({
      email,
      displayName: 'Utilisateur e2e',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      authenticationSource: AuthenticationSource.Local,
      isActive: true,
    }),
  );

  return {
    id: entity.id,
    email,
    password,
    cleanup: async () => {
      await dataSource.query('DELETE FROM auth_sessions WHERE user_id = @0', [
        entity.id,
      ]);
      await repository.delete({ id: entity.id });
    },
  };
}

/**
 * Extrait la valeur du cookie de refresh token depuis les en-têtes
 * Set-Cookie d'une réponse supertest.
 */
export function extractRefreshCookie(
  headers: Record<string, unknown>,
): string | undefined {
  const raw = headers['set-cookie'];
  const cookies = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? [raw]
      : [];
  const refreshCookie = cookies.find((cookie: string) =>
    cookie.startsWith('refresh_token='),
  );
  // Conserve "refresh_token=<valeur>" (sans les attributs Path/Expires...).
  return refreshCookie?.split(';')[0];
}
