import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetProductByIdUseCase } from '../../catalogue/application/get-product-by-id.use-case';
import { StockMovementType } from '../domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../domain/stock-level-repository.port';
import { STOCK_WRITER } from '../domain/stock-writer.port';
import type { StockWriterPort } from '../domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from '../domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../domain/warehouse-repository.port';

/** Données d'entrée (déjà validées par le DTO). */
export interface TransferStockInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
}

/** Niveau résultant d'un côté du transfert. */
export interface TransferredLevel {
  warehouseId: string;
  quantity: number;
}

/** Résultat du transfert : les deux niveaux mis à jour. */
export interface TransferResult {
  productId: string;
  from: TransferredLevel;
  to: TransferredLevel;
}

/**
 * Cas d'utilisation : transfert de stock entre deux entrepôts.
 *
 * LE cas qui justifie la transaction : 2 mouvements (TRANSFER côté
 * source, IN côté cible) + 2 niveaux, écrits atomiquement. Un plantage
 * au milieu ne peut PAS faire disparaître (ni dupliquer) du stock.
 */
@Injectable()
export class TransferStockUseCase {
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
    input: TransferStockInput,
  ): Promise<TransferResult> {
    if (
      input.fromWarehouseId.toLowerCase() === input.toWarehouseId.toLowerCase()
    ) {
      throw new BusinessRuleViolationException(
        "L'entrepôt source et l'entrepôt cible doivent être différents.",
      );
    }

    const product = await this.getProductByIdUseCase.execute(input.productId);
    if (!product.isStockManaged()) {
      throw new BusinessRuleViolationException(
        "Un service n'a pas de stock : seuls les articles de type " +
          'PRODUCT peuvent faire l’objet de mouvements.',
      );
    }

    const source = await this.warehouseRepository.findById(
      input.fromWarehouseId,
    );
    if (!source) {
      throw new ResourceNotFoundException("L'entrepôt source");
    }
    const target = await this.warehouseRepository.findById(input.toWarehouseId);
    if (!target) {
      throw new ResourceNotFoundException("L'entrepôt cible");
    }
    if (!source.isActive || !target.isActive) {
      throw new BusinessRuleViolationException(
        'Les deux entrepôts doivent être actifs pour un transfert.',
      );
    }

    const sourceLevel = await this.stockLevelRepository.findOne(
      input.productId,
      input.fromWarehouseId,
    );
    const sourceQuantity = sourceLevel?.quantity ?? 0;
    if (sourceQuantity < input.quantity) {
      throw new BusinessRuleViolationException(
        `Stock insuffisant dans l'entrepôt source : ${sourceQuantity} ` +
          `disponible(s), ${input.quantity} demandé(s).`,
      );
    }

    const targetLevel = await this.stockLevelRepository.findOne(
      input.productId,
      input.toWarehouseId,
    );
    const targetQuantity = targetLevel?.quantity ?? 0;

    const performedAt = new Date();
    const notes = input.notes ?? null;

    await this.stockWriter.write(
      [
        // Côté source : TRANSFER, avec l'entrepôt de destination tracé.
        {
          productId: input.productId,
          warehouseId: input.fromWarehouseId,
          targetWarehouseId: input.toWarehouseId,
          type: StockMovementType.Transfer,
          quantity: input.quantity,
          unitCost: null,
          reference: null,
          notes,
          performedBy: actor.userId,
          performedAt,
        },
        // Côté cible : IN (la marchandise arrive), mêmes notes.
        {
          productId: input.productId,
          warehouseId: input.toWarehouseId,
          targetWarehouseId: null,
          type: StockMovementType.In,
          quantity: input.quantity,
          unitCost: null,
          reference: null,
          notes,
          performedBy: actor.userId,
          performedAt,
        },
      ],
      [
        {
          productId: input.productId,
          warehouseId: input.fromWarehouseId,
          quantity: sourceQuantity - input.quantity,
        },
        {
          productId: input.productId,
          warehouseId: input.toWarehouseId,
          quantity: targetQuantity + input.quantity,
        },
      ],
    );

    return {
      productId: input.productId,
      from: {
        warehouseId: input.fromWarehouseId,
        quantity: sourceQuantity - input.quantity,
      },
      to: {
        warehouseId: input.toWarehouseId,
        quantity: targetQuantity + input.quantity,
      },
    };
  }
}
