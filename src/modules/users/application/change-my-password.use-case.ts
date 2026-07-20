import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { PASSWORD_HASHER } from '../../authentication/domain/password-hasher.port';
import type { PasswordHasherPort } from '../../authentication/domain/password-hasher.port';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : changer SON PROPRE mot de passe (tout utilisateur
 * connecté — la cible est toujours l'appelant, jamais un tiers).
 *
 * Règles :
 *   - le mot de passe ACTUEL doit être fourni et correct : trouver un
 *     poste déverrouillé ne suffit pas à s'approprier le compte ;
 *   - le nouveau mot de passe est hashé en Argon2id (jamais de clair en
 *     base), sa force est validée par le DTO.
 *
 * Limite assumée de cette version : les AUTRES sessions déjà ouvertes
 * restent valides après le changement (les révoquer touche au module
 * d'authentification — voir § « Ce qu'on verra plus tard »).
 */
@Injectable()
export class ChangeMyPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(actor.userId);

    // Un compte SSO n'a pas de mot de passe local à changer.
    if (!user || user.passwordHash === null) {
      throw new BusinessRuleViolationException(
        "Ce compte n'a pas de mot de passe local.",
      );
    }

    const currentIsValid = await this.passwordHasher.verify(
      user.passwordHash,
      currentPassword,
    );
    if (!currentIsValid) {
      // 409 plutôt que 401 : un 401 ferait déconnecter l'utilisateur par
      // la plupart des fronts, alors qu'il est bien authentifié — il
      // s'est juste trompé de mot de passe actuel.
      throw new BusinessRuleViolationException(
        'Le mot de passe actuel est incorrect.',
      );
    }

    const newPasswordHash = await this.passwordHasher.hash(newPassword);
    await this.userRepository.updatePasswordHash(actor.userId, newPasswordHash);
  }
}
