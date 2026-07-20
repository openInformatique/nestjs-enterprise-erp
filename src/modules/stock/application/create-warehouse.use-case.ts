import { Inject, Injectable } from '@nestjs/common';
import { ResourceAlreadyExistsException } from '../../../common/exceptions/app-exceptions';
import { Warehouse } from '../domain/warehouse';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateWarehouseInput {
  name: string;
  code: string;
  street?: string;
  city?: string;
}

/**
 * Cas d'utilisation : créer un entrepôt (ADMIN).
 * Le code est normalisé en MAJUSCULES puis son unicité est vérifiée —
 * même pattern que le SKU des produits (module 03).
 */
@Injectable()
export class CreateWarehouseUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
  ) {}

  async execute(input: CreateWarehouseInput): Promise<Warehouse> {
    const code = input.code.trim().toUpperCase();

    const existing = await this.warehouseRepository.findByCode(code);
    if (existing) {
      throw new ResourceAlreadyExistsException(
        'Un entrepôt avec ce code existe déjà.',
      );
    }

    return this.warehouseRepository.create({
      name: input.name.trim(),
      code,
      street: input.street?.trim() ?? null,
      city: input.city?.trim() ?? null,
    });
  }
}
