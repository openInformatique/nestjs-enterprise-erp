import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

/** Clé des métadonnées lues par RolesGuard. */
export const ROLES_KEY = 'roles';

/**
 * Restreint une route (ou un contrôleur entier) aux rôles listés.
 *
 * Exemple :
 *
 *   @Post()
 *   @Roles(UserRole.Admin)
 *   create(...) { ... }
 *
 * Sans ce décorateur, la route reste accessible à tout utilisateur
 * authentifié (le guard JWT global s'applique toujours).
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
