import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationFailedException } from '../../../common/exceptions/app-exceptions';
import { normalizeEmail } from '../../users/domain/user';
import { USER_REPOSITORY } from '../../users/domain/user-repository.port';
import type { UserRepositoryPort } from '../../users/domain/user-repository.port';
import {
  AuthenticatedIdentity,
  AuthenticationInput,
  IdentityProviderPort,
} from '../domain/identity-provider.port';
import { PASSWORD_HASHER } from '../domain/password-hasher.port';
import type { PasswordHasherPort } from '../domain/password-hasher.port';

/**
 * Hash Argon2id factice utilisé lorsque l'utilisateur n'existe pas :
 * une vérification est tout de même exécutée afin que la durée de
 * traitement ne révèle pas l'existence ou non du compte (anti-énumération).
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/**
 * Fournisseur d'identité LOCAL : vérifie e-mail + mot de passe contre
 * la table users.
 *
 * C'est le fournisseur initial du socle, en attendant le choix du SSO
 * définitif. Il implémente IdentityProviderPort : le remplacer ou le
 * compléter ne demande aucune modification des cas d'utilisation
 * (voir docs/sso-extension-guide.md).
 *
 * Toutes les issues d'échec lèvent la MÊME exception générique
 * AUTHENTICATION_FAILED : compte inconnu, inactif, supprimé, compte SSO
 * sans mot de passe local ou mot de passe erroné sont indiscernables.
 */
@Injectable()
export class LocalIdentityProvider implements IdentityProviderPort {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async authenticate(
    input: AuthenticationInput,
  ): Promise<AuthenticatedIdentity> {
    if (input.type !== 'local') {
      // Aucun fournisseur externe n'est branché dans cette version.
      throw new AuthenticationFailedException();
    }

    const email = normalizeEmail(input.email);
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.canAuthenticateLocally()) {
      // Vérification factice pour un temps de réponse homogène.
      await this.passwordHasher.verify(DUMMY_PASSWORD_HASH, input.password);
      throw new AuthenticationFailedException();
    }

    const passwordMatches = await this.passwordHasher.verify(
      // canAuthenticateLocally() garantit passwordHash non nul.
      user.passwordHash as string,
      input.password,
    );
    if (!passwordMatches) {
      throw new AuthenticationFailedException();
    }

    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
