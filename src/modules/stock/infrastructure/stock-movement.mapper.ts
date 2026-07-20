import { Injectable } from '@nestjs/common';
import { StockMovement } from '../domain/stock-movement';
import { StockMovementEntity } from './entities/stock-movement.entity';

/** Conversion entité TypeORM -> modèle de domaine. */
@Injectable()
export class StockMovementMapper {
  toDomain(entity: StockMovementEntity): StockMovement {
    return new StockMovement(
      entity.id,
      entity.productId,
      entity.warehouseId,
      entity.targetWarehouseId,
      entity.type,
      entity.quantity,
      entity.unitCost,
      entity.reference,
      entity.notes,
      entity.performedBy,
      entity.performedAt,
      entity.createdAt,
    );
  }
}
