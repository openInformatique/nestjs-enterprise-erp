/**
 * Préparation SSO — contrat de fournisseur d'identité.
 *
 * Le fournisseur définitif (Entra ID, OpenID Connect, AD/Kerberos...)
 * n'est pas encore choisi. Le socle fournit :
 *   - ce contrat neutre ;
 *   - une implémentation locale fonctionnelle (LocalIdentityProvider) ;
 *   - un point d'injection (IDENTITY_PROVIDER) permettant de remplacer
 *     ou compléter le fournisseur local sans toucher aux cas d'utilisation.
 *
 * Voir docs/sso-extension-guide.md pour la marche à suivre.
 */

/** Entrée d'authentification locale (e-mail + mot de passe). */
export interface LocalAuthenticationInput {
  type: 'local';
  email: string;
  password: string;
}

/**
 * Entrée d'authentification externe (réservée aux futurs fournisseurs :
 * assertion SAML, code OIDC, ticket Kerberos...).
 */
export interface ExternalAuthenticationInput {
  type: 'external';
  /** Identifiant du fournisseur (ex. : 'entra-id'). */
  provider: string;
  /** Matériel d'authentification opaque, interprété par le fournisseur. */
  credentials: Record<string, unknown>;
}

export type AuthenticationInput =
  LocalAuthenticationInput | ExternalAuthenticationInput;

/**
 * Identité renvoyée par un fournisseur après authentification réussie.
 *
 * `userId` est l'identifiant INTERNE : chaque fournisseur est responsable
 * de faire le lien entre l'identité externe et un utilisateur de la table
 * `users` (champ authentication_source = SSO pour les comptes fédérés).
 */
export interface AuthenticatedIdentity {
  userId: string;
  email: string;
  displayName: string;
}

/**
 * Contrat de fournisseur d'identité.
 *
 * Une authentification échouée doit lever AuthenticationFailedException
 * (message générique, sans révéler si le compte existe).
 */
export interface IdentityProviderPort {
  authenticate(input: AuthenticationInput): Promise<AuthenticatedIdentity>;
}

/** Jeton d'injection du fournisseur d'identité. */
export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
