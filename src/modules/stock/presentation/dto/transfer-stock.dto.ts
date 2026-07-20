import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Corps de POST /stock/transfer (ADMIN et MANAGER). */
export class TransferStockDto {
  @ApiProperty({ description: 'Produit concerné (type PRODUCT).' })
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId!: string;

  @ApiProperty({ description: 'Entrepôt source (actif).' })
  @IsUUID(undefined, {
    message: 'Le fromWarehouseId doit être un UUID valide.',
  })
  fromWarehouseId!: string;

  @ApiProperty({ description: 'Entrepôt cible (actif, différent du source).' })
  @IsUUID(undefined, {
    message: 'Le toWarehouseId doit être un UUID valide.',
  })
  toWarehouseId!: string;

  @ApiProperty({ description: 'Quantité transférée (entier > 0).', example: 4 })
  @IsInt({ message: 'La quantité doit être un entier.' })
  @IsPositive({ message: 'La quantité doit être strictement positive.' })
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
