import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/**
 * Cas d'utilisation : réactiver un utilisateur désactivé (ADMIN
 * uniquement, imposé par @Roles au niveau du contrôleur).
 *
 * Pendant inverse de DeactivateUserUseCase : efface deleted_at et remet
 * is_active = true. Sans lui, une désactivation par erreur ne se répare
 * qu'en SQL direct — inacceptable une fois déployé chez un client.
 */
@Injectable()
export class ReactivateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(targetUserId: string): Promise<User> {
    // findById ne voit pas les comptes soft-deletés : il faut la
    // variante IncludingDeleted pour retrouver la cible.
    const user =
      await this.userRepository.findByIdIncludingDeleted(targetUserId);
    if (!user) {
      throw new ResourceNotFoundException("L'utilisateur");
    }

    // Déjà actif : sortie silencieuse (l'appel est idempotent).
    if (user.deletedAt === null && user.isActive) {
      return user;
    }

    await this.userRepository.restore(targetUserId);

    // La ligne vient d'être restaurée : findById la retrouve forcément.
    return (await this.userRepository.findById(targetUserId)) as User;
  }
}
