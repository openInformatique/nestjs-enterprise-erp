import { AuthenticationSource } from './authentication-source.enum';
import { normalizeEmail, User } from './user';

const buildUser = (overrides: {
  passwordHash?: string | null;
  isActive?: boolean;
  deletedAt?: Date | null;
  authenticationSource?: AuthenticationSource;
}): User =>
  new User(
    'id-1',
    'user@local.dev',
    'Utilisateur',
    overrides.passwordHash === undefined ? 'hash' : overrides.passwordHash,
    overrides.authenticationSource ?? AuthenticationSource.Local,
    overrides.isActive ?? true,
    null,
    new Date(),
    new Date(),
    overrides.deletedAt ?? null,
  );

describe('User.canAuthenticateLocally', () => {
  it('autorise un utilisateur local actif avec mot de passe', () => {
    expect(buildUser({}).canAuthenticateLocally()).toBe(true);
  });

  it('refuse un utilisateur inactif', () => {
    expect(buildUser({ isActive: false }).canAuthenticateLocally()).toBe(false);
  });

  it('refuse un utilisateur supprimé logiquement', () => {
    expect(buildUser({ deletedAt: new Date() }).canAuthenticateLocally()).toBe(
      false,
    );
  });

  it('refuse un utilisateur sans mot de passe local (futur compte SSO)', () => {
    expect(buildUser({ passwordHash: null }).canAuthenticateLocally()).toBe(
      false,
    );
  });

  it('refuse un utilisateur de source SSO', () => {
    expect(
      buildUser({
        authenticationSource: AuthenticationSource.Sso,
      }).canAuthenticateLocally(),
    ).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('normalise en minuscules et retire les espaces', () => {
    expect(normalizeEmail('  Admin@Local.DEV ')).toBe('admin@local.dev');
  });
});
