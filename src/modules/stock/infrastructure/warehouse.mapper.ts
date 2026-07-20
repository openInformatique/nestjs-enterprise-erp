import { Injectable } from '@nestjs/common';
import { Warehouse } from '../domain/warehouse';
import { WarehouseEntity } from './entities/warehouse.entity';

/** Conversion entité TypeORM <-> modèle de domaine. */
@Injectable()
export class WarehouseMapper {
  toDomain(entity: WarehouseEntity): Warehouse {
    return new Warehouse(
      entity.id,
      entity.name,
      entity.code,
      entity.street,
      entity.city,
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
    );
  }
}
