import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { User } from '../../domain/user';

/**
 * Représentation publique d'un utilisateur.
 * NE CONTIENT NI passwordHash NI deletedAt : ce qui n'est pas dans ce
 * DTO ne peut pas fuiter.
 */
export class UserResponseDto {
  @ApiProperty({ description: "Identifiant de l'utilisateur (UUID)." })
  id!: string;

  @ApiProperty({ example: 'marie.dupont@entreprise.fr' })
  email!: string;

  @ApiProperty({ example: 'Marie Dupont' })
  displayName!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.Employee })
  role!: UserRole;

  @ApiProperty({ description: 'False pour un compte suspendu.' })
  isActive!: boolean;

  @ApiProperty({ description: 'Dernière connexion réussie.', nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ description: 'Date de création du compte.' })
  createdAt!: Date;

  /** Conversion domaine -> DTO : le SEUL endroit où l'on choisit ce qui sort. */
  static fromDomain(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.displayName = user.displayName;
    dto.role = user.role;
    dto.isActive = user.isActive;
    dto.lastLoginAt = user.lastLoginAt;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
