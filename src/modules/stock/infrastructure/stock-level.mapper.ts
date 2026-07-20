import { Injectable } from '@nestjs/common';
import { StockLevel, StockLevelView } from '../domain/stock-level';
import { ProductEntity } from '../../catalogue/infrastructure/entities/product.entity';
import { StockLevelEntity } from './entities/stock-level.entity';
import { WarehouseEntity } from './entities/warehouse.entity';

/** Conversion entité TypeORM -> modèle de domaine / vue enrichie. */
@Injectable()
export class StockLevelMapper {
  toDomain(entity: StockLevelEntity): StockLevel {
    return new StockLevel(
      entity.productId,
      entity.warehouseId,
      entity.quantity,
      entity.updatedAt,
    );
  }

  /**
   * Vue enrichie : EXIGE que les relations product et warehouse aient
   * été chargées (innerJoinAndSelect dans le repository) — sinon les
   * casts ci-dessous mentiraient.
   */
  toView(entity: StockLevelEntity): StockLevelView {
    const product = entity.product as ProductEntity;
    const warehouse = entity.warehouse as WarehouseEntity;
    return {
      productId: entity.productId,
      productSku: product.sku,
      productName: product.name,
      warehouseId: entity.warehouseId,
      warehouseName: warehouse.name,
      quantity: entity.quantity,
      updatedAt: entity.updatedAt,
    };
  }
}
