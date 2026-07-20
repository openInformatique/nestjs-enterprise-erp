import { ApiProperty } from '@nestjs/swagger';
import { StockMovement } from '../../domain/stock-movement';
import { StockMovementType } from '../../domain/stock-movement-type.enum';

/**
 * Représentation publique d'un mouvement de stock.
 * Version minimale : expose les ids ; les noms produit/entrepôt joints
 * dans l'historique arrivent au niveau min- (même pattern de jointure
 * que GET /stock).
 */
export class StockMovementResponseDto {
  @ApiProperty({ description: 'Identifiant du mouvement (UUID).' })
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ description: 'Entrepôt concerné (source pour un TRANSFER).' })
  warehouseId!: string;

  @ApiProperty({
    description: 'Entrepôt de destination — TRANSFER uniquement.',
    nullable: true,
  })
  targetWarehouseId!: string | null;

  @ApiProperty({ enum: StockMovementType })
  type!: StockMovementType;

  @ApiProperty({ description: 'Toujours positive (direction = type).' })
  quantity!: number;

  @ApiProperty({ nullable: true, example: 220 })
  unitCost!: number | null;

  @ApiProperty({ nullable: true })
  reference!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: "UUID de l'utilisateur qui a agi." })
  performedBy!: string;

  @ApiProperty()
  performedAt!: Date;

  static fromDomain(movement: StockMovement): StockMovementResponseDto {
    const dto = new StockMovementResponseDto();
    dto.id = movement.id;
    dto.productId = movement.productId;
    dto.warehouseId = movement.warehouseId;
    dto.targetWarehouseId = movement.targetWarehouseId;
    dto.type = movement.type;
    dto.quantity = movement.quantity;
    dto.unitCost = movement.unitCost;
    dto.reference = movement.reference;
    dto.notes = movement.notes;
    dto.performedBy = movement.performedBy;
    dto.performedAt = movement.performedAt;
    return dto;
  }
}
