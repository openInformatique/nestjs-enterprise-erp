import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Corps de POST /stock/out (tout utilisateur connecté). */
export class RecordStockOutDto {
  @ApiProperty({ description: 'Produit concerné (type PRODUCT).' })
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId!: string;

  @ApiProperty({ description: 'Entrepôt de sortie (actif).' })
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId!: string;

  @ApiProperty({ description: 'Quantité sortie (entier > 0).', example: 3 })
  @IsInt({ message: 'La quantité doit être un entier.' })
  @IsPositive({ message: 'La quantité doit être strictement positive.' })
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Référence externe (ex. : bon de livraison).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
