import { ApiProperty } from '@nestjs/swagger';

/** Un produit sous le seuil de stock, dans un entrepôt. */
export class StockAlertDto {
  @ApiProperty({ description: 'Identifiant du produit (UUID).' })
  productId!: string;

  @ApiProperty({ example: 'SKU-ECR-27Q' })
  sku!: string;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  name!: string;

  @ApiProperty({ description: "Identifiant de l'entrepôt (UUID)." })
  warehouseId!: string;

  @ApiProperty({
    description: "Nom de l'entrepôt.",
    example: 'Entrepôt Paris Nord',
  })
  warehouse!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ description: 'Seuil utilisé pour cette alerte.', example: 5 })
  threshold!: number;
}
