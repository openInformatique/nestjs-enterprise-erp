import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword, MinLength } from 'class-validator';

/** Corps de PATCH /users/me/password (tout utilisateur connecté). */
export class ChangeMyPasswordDto {
  @ApiProperty({
    description: 'Mot de passe actuel, vérifié avant tout changement.',
  })
  @IsString()
  @MinLength(1, { message: 'Le mot de passe actuel est obligatoire.' })
  currentPassword!: string;

  @ApiProperty({
    description:
      'Au moins 8 caractères, avec majuscule, minuscule, chiffre et symbole.',
    example: 'Erp!2027#neuf',
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
        'Le nouveau mot de passe doit contenir au moins 8 caractères, ' +
        'une majuscule, une minuscule, un chiffre et un symbole.',
    },
  )
  newPassword!: string;
}
