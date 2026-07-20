import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProductType } from '../../domain/product-type.enum';
import { ProductUnit } from '../../domain/product-unit.enum';

/** Corps de POST /products (ADMIN et MANAGER). */
export class CreateProductDto {
  @ApiPropertyOptional({
    description:
      'Référence unique. Absente : auto-générée (PROD-0001, PROD-0002...).',
    example: 'ECR-DELL-27',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{3,30}$/, {
    message: 'Le SKU doit faire 3 à 30 caractères (lettres, chiffres, tirets).',
  })
  sku?: string;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  @IsString()
  @MinLength(1, { message: 'Le nom du produit est obligatoire.' })
  @MaxLength(255, {
    message: 'Le nom du produit ne peut pas dépasser 255 caractères.',
  })
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'La description ne peut pas dépasser 2000 caractères.',
  })
  description?: string;

  @ApiProperty({
    description: 'PRODUCT = bien physique (stock) ; SERVICE = prestation.',
    enum: ProductType,
    example: ProductType.Product,
  })
  @IsEnum(ProductType, {
    message: 'Le type doit valoir PRODUCT ou SERVICE.',
  })
  type!: ProductType;

  @ApiPropertyOptional({ description: 'Catégorie de rattachement.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le categoryId doit être un UUID valide.',
  })
  categoryId?: string;

  @ApiProperty({
    description: 'Prix de vente HT en EUR (2 décimales max).',
    example: 349.9,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le prix de vente doit être un nombre (2 décimales max).' },
  )
  @IsPositive({ message: 'Le prix de vente doit être strictement positif.' })
  unitPrice!: number;

  @ApiPropertyOptional({
    description: "Prix d'achat HT en EUR (calcul de marge).",
    example: 220,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Le prix d'achat doit être un nombre (2 décimales max)." },
  )
  @Min(0, { message: "Le prix d'achat ne peut pas être négatif." })
  purchasePrice?: number;

  @ApiPropertyOptional({
    description: 'Taux de TVA en % (taux français en vigueur).',
    default: 20,
    enum: [0, 5.5, 10, 20],
  })
  @IsOptional()
  @IsIn([0, 5.5, 10, 20], {
    message: 'Le taux de TVA doit valoir 0, 5.5, 10 ou 20.',
  })
  vatRate?: number;

  @ApiProperty({ enum: ProductUnit, example: ProductUnit.Unit })
  @IsEnum(ProductUnit, {
    message: "L'unité doit valoir UNIT, KG, LITER, HOUR, DAY ou METER.",
  })
  unit!: ProductUnit;
}
