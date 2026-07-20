/**
 * Contrat de hachage de mots de passe.
 *
 * Implémenté par Argon2id dans l'infrastructure. Le domaine et les cas
 * d'utilisation ne connaissent jamais l'algorithme concret.
 */
export interface PasswordHasherPort {
  hash(plainPassword: string): Promise<string>;
  verify(passwordHash: string, plainPassword: string): Promise<boolean>;
}

/** Jeton d'injection du service de hachage. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
