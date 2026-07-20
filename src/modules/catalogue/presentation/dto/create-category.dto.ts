import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Corps de POST /categories (ADMIN et MANAGER). */
export class CreateCategoryDto {
  @ApiProperty({ example: 'Matériel informatique' })
  @IsString()
  @MinLength(1, { message: 'Le nom de la catégorie est obligatoire.' })
  @MaxLength(100, {
    message: 'Le nom de la catégorie ne peut pas dépasser 100 caractères.',
  })
  name!: string;

  @ApiPropertyOptional({ example: 'Ordinateurs, écrans, périphériques.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description:
      'Catégorie parente (doit être une catégorie racine : 1 seul ' +
      'niveau de sous-catégories).',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le parentId doit être un UUID valide.',
  })
  parentId?: string;
}
