import { SetMetadata } from '@nestjs/common';
import { AuthorizationRequirement } from '../../modules/authentication/domain/authorization.port';

/** Clé de métadonnée des exigences d'autorisation. */
export const AUTHORIZATION_REQUIREMENTS_KEY = 'authorizationRequirements';

/**
 * Déclare l'exigence d'autorisation d'un endpoint — POINT D'EXTENSION.
 *
 * IMPORTANT : dans cette version du socle, ce décorateur pose uniquement
 * des métadonnées ; AUCUN guard ne les évalue (le modèle de permissions
 * définitif n'est pas choisi et le socle refuse d'embarquer un faux
 * système permissif). Seule l'authentification est imposée.
 *
 * Le jour venu : fournir une implémentation d'AuthorizationPort, créer
 * un guard lisant ces métadonnées et l'enregistrer après le guard JWT
 * (voir docs/authorization-extension-guide.md).
 *
 * Exemple d'usage futur :
 *
 *   @RequiresPermission({ permission: 'users.read' })
 *   @Get()
 *   findAll() { ... }
 */
export const RequiresPermission = (
  ...requirements: AuthorizationRequirement[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHORIZATION_REQUIREMENTS_KEY, requirements);
