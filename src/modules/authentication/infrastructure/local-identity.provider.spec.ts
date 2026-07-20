import { AuthenticationFailedException } from '../../../common/exceptions/app-exceptions';
import { AuthenticationSource } from '../../users/domain/authentication-source.enum';
import { User } from '../../users/domain/user';
import { UserRepositoryPort } from '../../users/domain/user-repository.port';
import { PasswordHasherPort } from '../domain/password-hasher.port';
import { LocalIdentityProvider } from './local-identity.provider';

const buildUser = (overrides: {
  isActive?: boolean;
  passwordHash?: string | null;
  authenticationSource?: AuthenticationSource;
}): User =>
  new User(
    'user-1',
    'admin@local.dev',
    'Administrateur',
    overrides.passwordHash === undefined
      ? 'hash-valide'
      : overrides.passwordHash,
    overrides.authenticationSource ?? AuthenticationSource.Local,
    overrides.isActive ?? true,
    null,
    new Date(),
    new Date(),
    null,
  );

/** Hasher factice : « bon » mot de passe = 'bon-mot-de-passe'. */
const fakeHasher: PasswordHasherPort = {
  hash: () => Promise.resolve('hash'),
  verify: (_hash, plain) => Promise.resolve(plain === 'bon-mot-de-passe'),
};

const buildProvider = (user: User | null): LocalIdentityProvider => {
  const repository: UserRepositoryPort = {
    findById: () => Promise.resolve(null),
    findByEmail: (email) =>
      Promise.resolve(user && user.email === email ? user : null),
    updateLastLoginAt: () => Promise.resolve(),
  };
  return new LocalIdentityProvider(repository, fakeHasher);
};

describe('LocalIdentityProvider', () => {
  it('authentifie un utilisateur valide et normalise l’e-mail', async () => {
    const provider = buildProvider(buildUser({}));

    const identity = await provider.authenticate({
      type: 'local',
      email: '  ADMIN@Local.dev ',
      password: 'bon-mot-de-passe',
    });

    expect(identity).toEqual({
      userId: 'user-1',
      email: 'admin@local.dev',
      displayName: 'Administrateur',
    });
  });

  const expectGenericFailure = async (
    provider: LocalIdentityProvider,
    password = 'bon-mot-de-passe',
  ): Promise<void> => {
    await expect(
      provider.authenticate({
        type: 'local',
        email: 'admin@local.dev',
        password,
      }),
    ).rejects.toThrow(AuthenticationFailedException);
  };

  it('refuse un utilisateur inconnu (message générique)', async () => {
    await expectGenericFailure(buildProvider(null));
  });

  it('refuse un mot de passe erroné (même message générique)', async () => {
    await expectGenericFailure(buildProvider(buildUser({})), 'mauvais');
  });

  it('refuse un utilisateur inactif', async () => {
    await expectGenericFailure(buildProvider(buildUser({ isActive: false })));
  });

  it('refuse un compte SSO sans mot de passe local', async () => {
    await expectGenericFailure(
      buildProvider(
        buildUser({
          passwordHash: null,
          authenticationSource: AuthenticationSource.Sso,
        }),
      ),
    );
  });

  it("refuse une entrée d'authentification externe (aucun SSO branché)", async () => {
    const provider = buildProvider(buildUser({}));

    await expect(
      provider.authenticate({
        type: 'external',
        provider: 'entra-id',
        credentials: {},
      }),
    ).rejects.toThrow(AuthenticationFailedException);
  });
});
