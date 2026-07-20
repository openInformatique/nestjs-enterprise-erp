import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Une ligne du corps de création/modification d'un devis.
 *
 * Deux usages :
 *   - ligne PRODUIT : productId fourni — description, unitPrice et
 *     vatRate sont optionnels (copiés du produit si absents) ;
 *   - ligne LIBRE : pas de productId — description et unitPrice
 *     deviennent obligatoires (vérifié par le use case).
 */
export class QuoteLineInputDto {
  @ApiPropertyOptional({
    description: 'Produit du catalogue ; absent = ligne libre.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId?: string;

  @ApiPropertyOptional({
    description: 'Obligatoire pour une ligne libre ; sinon copiée du produit.',
    example: 'Écran Dell 27" QHD',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La description ne peut pas être vide.' })
  @MaxLength(500, {
    message: 'La description ne peut pas dépasser 500 caractères.',
  })
  description?: string;

  @ApiProperty({
    description: 'Quantité (décimales autorisées : 2.5 heures).',
    example: 2,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La quantité doit être un nombre (2 décimales max).' },
  )
  @IsPositive({ message: 'La quantité doit être strictement positive.' })
  quantity!: number;

  @ApiPropertyOptional({
    description:
      'Prix unitaire HT en EUR. Obligatoire pour une ligne libre ; ' +
      'sinon copié du produit.',
    example: 349.9,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le prix unitaire doit être un nombre (2 décimales max).' },
  )
  @Min(0, { message: 'Le prix unitaire ne peut pas être négatif.' })
  unitPrice?: number;

  @ApiPropertyOptional({
    description: 'Taux de TVA en % ; sinon copié du produit (défaut 20).',
    enum: [0, 5.5, 10, 20],
  })
  @IsOptional()
  @IsIn([0, 5.5, 10, 20], {
    message: 'Le taux de TVA doit valoir 0, 5.5, 10 ou 20.',
  })
  vatRate?: number;

  @ApiPropertyOptional({
    description: 'Remise en % (0–100, défaut 0).',
    example: 10,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La remise doit être un nombre (2 décimales max).' },
  )
  @Min(0, { message: 'La remise ne peut pas être négative.' })
  @Max(100, { message: 'La remise ne peut pas dépasser 100 %.' })
  discountPercent?: number;
}
