import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Corps de la requête POST /auth/login. */
export class LoginRequestDto {
  @ApiProperty({
    description: "Adresse e-mail de l'utilisateur.",
    example: 'admin@local.dev',
  })
  @IsEmail({}, { message: 'L’adresse e-mail n’est pas valide.' })
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    description: 'Mot de passe.',
    example: 'MotDePasse!123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @MaxLength(200)
  password!: string;
}
