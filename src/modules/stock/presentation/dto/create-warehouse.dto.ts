import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Corps de POST /warehouses (ADMIN). */
export class CreateWarehouseDto {
  @ApiProperty({ example: 'Entrepôt Paris Nord' })
  @IsString()
  @MinLength(1, { message: "Le nom de l'entrepôt est obligatoire." })
  @MaxLength(100, {
    message: "Le nom de l'entrepôt ne peut pas dépasser 100 caractères.",
  })
  name!: string;

  @ApiProperty({
    description: 'Code court unique (normalisé en MAJUSCULES).',
    example: 'WH-PARIS',
  })
  @Matches(/^[A-Za-z0-9-]{2,20}$/, {
    message:
      'Le code doit faire 2 à 20 caractères (lettres, chiffres, tirets).',
  })
  code!: string;

  @ApiPropertyOptional({ example: '12 rue de la Logistique' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @ApiPropertyOptional({ example: 'Saint-Denis' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}
