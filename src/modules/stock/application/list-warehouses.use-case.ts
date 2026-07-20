import { Inject, Injectable } from '@nestjs/common';
import { Warehouse } from '../domain/warehouse';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type {
  ListWarehousesFilters,
  WarehouseRepositoryPort,
} from '../domain/warehouse-repository.port';

/** Cas d'utilisation : lister les entrepôts (liste courte, non paginée). */
@Injectable()
export class ListWarehousesUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
  ) {}

  execute(filters: ListWarehousesFilters): Promise<Warehouse[]> {
    return this.warehouseRepository.findAll(filters);
  }
}
