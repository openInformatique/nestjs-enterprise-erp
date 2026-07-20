import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '../../../common/enums/user-role.enum';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : changer le rôle d'un utilisateur (ADMIN uniquement,
 * imposé par @Roles au niveau du contrôleur).
 *
 * Deux garde-fous anti-verrouillage :
 *   - interdiction de modifier son PROPRE rôle : un admin qui se
 *     rétrograde perdrait l'accès à l'administration à l'appel suivant ;
 *   - interdiction de rétrograder le DERNIER admin actif : plus personne
 *     ne pourrait administrer l'application (réparation en SQL direct).
 */
@Injectable()
export class ChangeUserRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    targetUserId: string,
    newRole: UserRole,
  ): Promise<User> {
    // UUID SQL Server en MAJUSCULES vs JWT en minuscules : comparaison
    // insensible à la casse (même piège qu'à la désactivation).
    if (actor.userId.toLowerCase() === targetUserId.toLowerCase()) {
      throw new BusinessRuleViolationException(
        'Vous ne pouvez pas modifier votre propre rôle.',
      );
    }

    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new ResourceNotFoundException("L'utilisateur");
    }

    // Aucun changement : sortie silencieuse, pas d'écriture inutile.
    if (user.role === newRole) {
      return user;
    }

    // Rétrograder le dernier admin actif verrouillerait l'administration.
    if (
      user.role === UserRole.Admin &&
      user.isActive &&
      (await this.userRepository.countActiveAdmins()) <= 1
    ) {
      throw new BusinessRuleViolationException(
        'Impossible de rétrograder le dernier administrateur actif.',
      );
    }

    return this.userRepository.update(targetUserId, { role: newRole });
  }
}
