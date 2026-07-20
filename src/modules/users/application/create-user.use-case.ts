import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ResourceAlreadyExistsException } from '../../../common/exceptions/app-exceptions';
import { PASSWORD_HASHER } from '../../authentication/domain/password-hasher.port';
import type { PasswordHasherPort } from '../../authentication/domain/password-hasher.port';
import { normalizeEmail, User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type { UserRepositoryPort } from '../domain/user-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
}

/**
 * Cas d'utilisation : créer un utilisateur (réservé ADMIN au niveau
 * du contrôleur).
 *
 * Règles :
 *   - e-mail normalisé puis unicité vérifiée (409 sinon) ;
 *   - mot de passe hashé en Argon2id — jamais stocké en clair ;
 *   - rôle par défaut : EMPLOYEE (moindre privilège).
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    const email = normalizeEmail(input.email);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ResourceAlreadyExistsException(
        'Un utilisateur avec cet e-mail existe déjà.',
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    return this.userRepository.create({
      email,
      displayName: input.displayName.trim(),
      passwordHash,
      role: input.role ?? UserRole.Employee,
    });
  }
}
