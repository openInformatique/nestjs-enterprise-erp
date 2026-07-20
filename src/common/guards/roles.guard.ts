import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithUser } from '../decorators/current-user.decorator';
import { AccessDeniedException } from '../exceptions/app-exceptions';
import { USER_REPOSITORY } from '../../modules/users/domain/user-repository.port';
import type { UserRepositoryPort } from '../../modules/users/domain/user-repository.port';

/**
 * Guard global d'autorisation par rôle.
 *
 * S'exécute APRÈS JwtAuthGuard (ordre d'enregistrement des APP_GUARD) :
 * request.user est donc déjà posé pour toute route protégée.
 *
 * Décision :
 *   - route sans @Roles() : accessible à tout utilisateur authentifié,
 *     AUCUNE requête SQL n'est faite ;
 *   - route avec @Roles(...) : l'utilisateur est rechargé en base et son
 *     rôle doit figurer dans la liste, sinon 403 ACCESS_DENIED.
 *
 * Version volontairement simple : le rôle est lu en base à chaque appel
 * protégé — toujours exact, au prix d'une requête. L'optimisation
 * consistant à embarquer le rôle dans le JWT est décrite dans le guide
 * min-DEV-01 (étape 6).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride : la métadonnée posée sur la MÉTHODE l'emporte
    // sur celle posée sur la CLASSE.
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // Pas d'exigence de rôle : l'authentification (JwtAuthGuard) suffit.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // @Roles sur une route @Public est une incohérence de configuration :
    // on refuse plutôt que d'ouvrir la route par accident.
    if (!user) {
      throw new AccessDeniedException();
    }

    // Rôle relu en base : un changement de rôle prend effet immédiatement.
    const account = await this.userRepository.findById(user.userId);
    if (!account || !requiredRoles.includes(account.role)) {
      throw new AccessDeniedException();
    }

    return true;
  }
}
