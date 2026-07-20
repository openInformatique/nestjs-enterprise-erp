import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';

/**
 * Préparation des rôles et permissions — contrats neutres.
 *
 * Le modèle définitif (RBAC, permissions unitaires, règles contextuelles)
 * n'est pas encore choisi : AUCUNE table ni implémentation permissive
 * n'existe. Le socle impose uniquement l'authentification sur les
 * endpoints protégés.
 *
 * Voir docs/authorization-extension-guide.md pour l'ajout ultérieur.
 */

/** Permission unitaire, ex. : 'users.read', 'invoices.approve'. */
export type Permission = string;

/**
 * Exigence d'autorisation évaluée par un futur guard : une permission
 * requise, éventuellement contextualisée par une ressource.
 */
export interface AuthorizationRequirement {
  permission: Permission;
  resourceType?: string;
  resourceId?: string;
}

/**
 * Contrat d'évaluation des autorisations.
 *
 * Aucune implémentation n'est fournie ni enregistrée : le socle ne doit
 * pas embarquer un faux système permissif. Le jour venu, une
 * implémentation sera fournie sous le jeton AUTHORIZATION_PORT et
 * consommée par un guard dédié.
 */
export interface AuthorizationPort {
  isAllowed(
    user: AuthenticatedUser,
    requirement: AuthorizationRequirement,
  ): Promise<boolean>;
}

/** Jeton d'injection du futur service d'autorisation. */
export const AUTHORIZATION_PORT = Symbol('AUTHORIZATION_PORT');
