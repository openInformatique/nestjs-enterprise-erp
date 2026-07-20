import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { Warehouse } from '../domain/warehouse';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type {
  UpdateWarehouseData,
  WarehouseRepositoryPort,
} from '../domain/warehouse-repository.port';

/** Champs modifiables (sémantique PATCH). */
export interface UpdateWarehouseInput {
  name?: string;
  code?: string;
  street?: string;
  city?: string;
  isActive?: boolean;
}

/**
 * Cas d'utilisation : modifier un entrepôt.
 *
 * isActive n'est accepté ici que pour RÉACTIVER (true) : la
 * désactivation passe obligatoirement par DELETE /warehouses/:id, qui
 * vérifie que l'entrepôt est vide. Sans ce verrou, PATCH serait une
 * porte dérobée qui contourne la règle « on ne désactive que vide ».
 */
@Injectable()
export class UpdateWarehouseUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
  ) {}

  async execute(
    warehouseId: string,
    input: UpdateWarehouseInput,
  ): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }

    if (input.isActive === false) {
      throw new BusinessRuleViolationException(
        'La désactivation passe par DELETE /warehouses/:id (elle vérifie ' +
          "que l'entrepôt est vide).",
      );
    }

    const changes: UpdateWarehouseData = { ...input };

    if (input.code !== undefined) {
      const code = input.code.trim().toUpperCase();
      const existing = await this.warehouseRepository.findByCode(code);
      // UUID SQL Server en MAJUSCULES vs paramètre d'URL : comparaison
      // insensible à la casse (cf. modules précédents).
      if (existing && existing.id.toLowerCase() !== warehouseId.toLowerCase()) {
        throw new ResourceAlreadyExistsException(
          'Un entrepôt avec ce code existe déjà.',
        );
      }
      changes.code = code;
    }

    if (input.name !== undefined) {
      changes.name = input.name.trim();
    }

    return this.warehouseRepository.update(warehouseId, changes);
  }
}
