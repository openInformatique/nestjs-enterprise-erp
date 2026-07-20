import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '../../../common/enums/user-role.enum';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : désactiver un utilisateur (soft-delete).
 *
 * Deux garde-fous anti-verrouillage :
 *   - interdiction de se désactiver soi-même — un ADMIN étourdi ne doit
 *     pas pouvoir se verrouiller dehors ;
 *   - interdiction de désactiver le dernier ADMIN actif — plus personne
 *     ne pourrait administrer l'application.
 */
@Injectable()
export class DeactivateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(actor: AuthenticatedUser, targetUserId: string): Promise<void> {
    // SQL Server renvoie les uniqueidentifier en MAJUSCULES alors que le
    // JWT porte l'UUID en minuscules : comparaison insensible à la casse.
    if (actor.userId.toLowerCase() === targetUserId.toLowerCase()) {
      throw new BusinessRuleViolationException(
        'Vous ne pouvez pas désactiver votre propre compte.',
      );
    }

    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new ResourceNotFoundException("L'utilisateur");
    }

    // Désactiver le dernier admin actif verrouillerait l'administration.
    if (
      user.role === UserRole.Admin &&
      user.isActive &&
      (await this.userRepository.countActiveAdmins()) <= 1
    ) {
      throw new BusinessRuleViolationException(
        'Impossible de désactiver le dernier administrateur actif.',
      );
    }

    await this.userRepository.softDelete(targetUserId);
  }
}
