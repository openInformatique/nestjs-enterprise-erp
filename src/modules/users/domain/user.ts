import { UserRole } from '../../../common/enums/user-role.enum';
import { AuthenticationSource } from './authentication-source.enum';

/**
 * Modèle de domaine de l'utilisateur technique.
 *
 * Classe pure : aucune dépendance à NestJS, TypeORM ou Express.
 * L'entité TypeORM correspondante vit dans la couche infrastructure ;
 * le UserMapper assure la conversion entre les deux.
 */
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly displayName: string,
    /** Hash Argon2id ; null pour les comptes SSO (aucun mot de passe local). */
    public readonly passwordHash: string | null,
    public readonly authenticationSource: AuthenticationSource,
    /** Rôle applicatif : gouverne les autorisations via RolesGuard. */
    public readonly role: UserRole,
    public readonly isActive: boolean,
    public readonly lastLoginAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  /**
   * Un utilisateur ne peut s'authentifier localement que s'il est actif,
   * non supprimé et possède un mot de passe local.
   */
  canAuthenticateLocally(): boolean {
    return (
      this.isActive &&
      this.deletedAt === null &&
      this.passwordHash !== null &&
      this.authenticationSource === AuthenticationSource.Local
    );
  }
}

/**
 * Normalise un e-mail : minuscules et espaces retirés.
 * Appliquée AVANT toute recherche ou écriture en base.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
