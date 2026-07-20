import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../domain/stock-level-repository.port';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/**
 * Cas d'utilisation : désactiver un entrepôt (ADMIN).
 *
 * Règle : uniquement s'il est VIDE. Sinon le stock restant deviendrait
 * invisible des opérations (un entrepôt inactif n'accepte plus de
 * mouvements) — on force l'utilisateur à transférer ou ajuster d'abord.
 */
@Injectable()
export class DeactivateWarehouseUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
  ) {}

  async execute(warehouseId: string): Promise<void> {
    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }

    // Déjà inactif : sortie silencieuse (appel idempotent).
    if (!warehouse.isActive) {
      return;
    }

    const total =
      await this.stockLevelRepository.sumQuantityForWarehouse(warehouseId);
    if (total > 0) {
      throw new BusinessRuleViolationException(
        `Impossible de désactiver cet entrepôt : il reste ${total} ` +
          'unité(s) en stock. Transférez ou ajustez le stock d’abord.',
      );
    }

    await this.warehouseRepository.deactivate(warehouseId);
  }
}
