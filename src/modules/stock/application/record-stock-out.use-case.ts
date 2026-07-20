import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { StockMovement } from '../domain/stock-movement';
import { StockMovementType } from '../domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../domain/stock-level-repository.port';
import { STOCK_WRITER } from '../domain/stock-writer.port';
import type { StockWriterPort } from '../domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Données d'entrée (déjà validées par le DTO). */
export interface RecordStockOutInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  reference?: string;
  notes?: string;
}

/**
 * Cas d'utilisation : sortie de stock (vente, consommation).
 *
 * Règle centrale : le stock disponible doit suffire — le message
 * d'erreur dit PRÉCISÉMENT combien est disponible et combien est
 * demandé. En cas d'accès concurrents, la contrainte CHECK en base
 * est le filet de sécurité final.
 */
@Injectable()
export class RecordStockOutUseCase {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: RecordStockOutInput,
  ): Promise<StockMovement> {
    const product = await this.getProductByIdUseCase.execute(input.productId);
    if (!product.isStockManaged()) {
      throw new BusinessRuleViolationException(
        "Un service n'a pas de stock : seuls les articles de type " +
          'PRODUCT peuvent faire l’objet de mouvements.',
      );
    }

    const warehouse = await this.warehouseRepository.findById(
      input.warehouseId,
    );
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }
    if (!warehouse.isActive) {
      throw new BusinessRuleViolationException(
        `L'entrepôt ${warehouse.code} est désactivé : aucun mouvement possible.`,
      );
    }

    const level = await this.stockLevelRepository.findOne(
      input.productId,
      input.warehouseId,
    );
    const currentQuantity = level?.quantity ?? 0;

    if (currentQuantity < input.quantity) {
      throw new BusinessRuleViolationException(
        `Stock insuffisant : ${currentQuantity} disponible(s), ` +
          `${input.quantity} demandé(s).`,
      );
    }

    const written = await this.stockWriter.write(
      [
        {
          productId: input.productId,
          warehouseId: input.warehouseId,
          targetWarehouseId: null,
          type: StockMovementType.Out,
          quantity: input.quantity,
          unitCost: null,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          performedBy: actor.userId,
          performedAt: new Date(),
        },
      ],
      [
        {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: currentQuantity - input.quantity,
        },
      ],
    );

    return written[0]!;
  }
}
