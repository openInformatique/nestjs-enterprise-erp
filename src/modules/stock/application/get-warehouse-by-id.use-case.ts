import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Warehouse } from '../domain/warehouse';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Cas d'utilisation : récupérer un entrepôt (404 si inconnu). */
@Injectable()
export class GetWarehouseByIdUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
  ) {}

  async execute(warehouseId: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }
    return warehouse;
  }
}
