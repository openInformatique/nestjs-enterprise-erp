import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { AuthenticationSource } from '../../domain/authentication-source.enum';
import { UserRole } from '../../../../common/enums/user-role.enum';

/**
 * Entité TypeORM de la table `users`.
 *
 * Représente un utilisateur technique pouvant s'authentifier localement
 * ou, plus tard, être associé à une identité SSO.
 *
 * Contraintes portées par le schéma :
 *   - e-mail unique (index filtré sur les lignes non supprimées) ;
 *   - e-mail normalisé en minuscules par la couche application AVANT
 *     toute écriture ou recherche ;
 *   - password_hash nullable : les futurs comptes SSO n'ont pas de
 *     mot de passe local ; jamais de mot de passe en clair.
 */
@Entity({ name: 'users' })
export class UserEntity extends AuditableEntity {
  @Index('UQ_users_email', { unique: true })
  @Column({ name: 'email', type: 'nvarchar', length: 320 })
  email!: string;

  @Column({ name: 'display_name', type: 'nvarchar', length: 200 })
  displayName!: string;

  /** Hash Argon2id du mot de passe ; null pour les comptes SSO. */
  @Column({
    name: 'password_hash',
    type: 'nvarchar',
    length: 500,
    nullable: true,
  })
  passwordHash!: string | null;

  @Column({
    name: 'authentication_source',
    type: 'nvarchar',
    length: 20,
    default: AuthenticationSource.Local,
  })
  authenticationSource!: AuthenticationSource;

  /**
   * Rôle applicatif (RBAC). SQL Server n'a pas de type enum : la valeur
   * de l'enum TypeScript est stockée en nvarchar, comme pour
   * authentication_source.
   */
  @Column({
    name: 'role',
    type: 'nvarchar',
    length: 20,
    default: UserRole.Employee,
  })
  role!: UserRole;

  /** Un utilisateur inactif ne peut plus se connecter. */
  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', type: 'datetime2', nullable: true })
  lastLoginAt!: Date | null;
}
