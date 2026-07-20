import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/** Corps de POST /stock/in (tout utilisateur connecté). */
export class RecordStockInDto {
  @ApiProperty({ description: 'Produit concerné (type PRODUCT).' })
  @IsUUID(undefined, {
    message: 'Le productId doit être un UUID valide.',
  })
  productId!: string;

  @ApiProperty({ description: 'Entrepôt de réception (actif).' })
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId!: string;

  @ApiProperty({ description: 'Quantité reçue (entier > 0).', example: 10 })
  @IsInt({ message: 'La quantité doit être un entier.' })
  @IsPositive({ message: 'La quantité doit être strictement positive.' })
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Coût unitaire HT en EUR (2 décimales max).',
    example: 220,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le coût unitaire doit être un nombre (2 décimales max).' },
  )
  @Min(0, { message: 'Le coût unitaire ne peut pas être négatif.' })
  unitCost?: number;

  @ApiPropertyOptional({
    description: 'Référence externe (ex. : commande fournisseur).',
    example: 'CMD-F-2026-0042',
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
