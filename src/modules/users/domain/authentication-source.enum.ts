/**
 * Source d'authentification d'un utilisateur technique.
 *
 * LOCAL : mot de passe géré par le socle (hash Argon2id en base).
 * SSO   : identité fournie par un fournisseur externe (à venir) ;
 *         l'utilisateur n'a alors aucun mot de passe local.
 */
export enum AuthenticationSource {
  Local = 'LOCAL',
  Sso = 'SSO',
}
