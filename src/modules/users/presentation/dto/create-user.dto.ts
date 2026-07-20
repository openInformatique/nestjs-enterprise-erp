import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../../common/enums/user-role.enum';

/** Corps de POST /users (réservé ADMIN). */
export class CreateUserDto {
  @ApiProperty({ example: 'nouvel.employe@entreprise.fr' })
  @IsEmail({}, { message: "L'e-mail est invalide." })
  @MaxLength(320, {
    message: "L'e-mail ne peut pas dépasser 320 caractères.",
  })
  email!: string;

  @ApiProperty({
    description:
      'Au moins 8 caractères, avec majuscule, minuscule, chiffre et symbole.',
    example: 'Erp!2026#demo',
  })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Le mot de passe doit contenir au moins 8 caractères, ' +
        'une majuscule, une minuscule, un chiffre et un symbole.',
    },
  )
  password!: string;

  @ApiProperty({ example: 'Marie Dupont' })
  @IsString()
  @MinLength(1, { message: 'Le nom affiché est obligatoire.' })
  @MaxLength(200, {
    message: 'Le nom affiché ne peut pas dépasser 200 caractères.',
  })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'Rôle initial (EMPLOYEE si absent).',
    enum: UserRole,
    default: UserRole.Employee,
  })
  @IsOptional()
  @IsEnum(UserRole, {
    message: 'Le rôle doit valoir ADMIN, MANAGER ou EMPLOYEE.',
  })
  role?: UserRole;
}
