import { ApiProperty } from '@nestjs/swagger';
import { StockLevelView } from '../../domain/stock-level';

/** Ligne de l'écran de stock : niveau ENRICHI des noms lisibles. */
export class StockLevelResponseDto {
  @ApiProperty({ description: 'Identifiant du produit (UUID).' })
  productId!: string;

  @ApiProperty({ example: 'PROD-0001' })
  productSku!: string;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  productName!: string;

  @ApiProperty({ description: "Identifiant de l'entrepôt (UUID)." })
  warehouseId!: string;

  @ApiProperty({ example: 'Entrepôt Paris Nord' })
  warehouseName!: string;

  @ApiProperty({ example: 12 })
  quantity!: number;

  @ApiProperty({ description: 'Date du dernier mouvement appliqué.' })
  updatedAt!: Date;

  static fromView(view: StockLevelView): StockLevelResponseDto {
    const dto = new StockLevelResponseDto();
    dto.productId = view.productId;
    dto.productSku = view.productSku;
    dto.productName = view.productName;
    dto.warehouseId = view.warehouseId;
    dto.warehouseName = view.warehouseName;
    dto.quantity = view.quantity;
    dto.updatedAt = view.updatedAt;
    return dto;
  }
}
