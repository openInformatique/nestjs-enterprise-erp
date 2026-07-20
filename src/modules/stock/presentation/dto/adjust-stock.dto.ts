import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Corps de POST /stock/adjust (ADMIN et MANAGER). */
export class AdjustStockDto {
  @ApiProperty({ description: 'Produit concerné (type PRODUCT).' })
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId!: string;

  @ApiProperty({ description: 'Entrepôt concerné (actif).' })
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId!: string;

  @ApiProperty({
    description: 'Quantité RÉELLEMENT comptée (cible, pas un delta).',
    example: 7,
  })
  @IsInt({ message: 'La quantité doit être un entier.' })
  @Min(0, { message: 'La quantité ne peut pas être négative.' })
  newQuantity!: number;

  @ApiProperty({
    description:
      'Justification OBLIGATOIRE : un ajustement sans explication est ' +
      'un trou dans la traçabilité d’inventaire.',
    example: 'Casse constatée lors de l’inventaire trimestriel.',
  })
  @IsString()
  @MinLength(1, { message: 'Les notes sont obligatoires pour un ajustement.' })
  @MaxLength(400, {
    message: 'Les notes ne peuvent pas dépasser 400 caractères.',
  })
  notes!: string;
}
