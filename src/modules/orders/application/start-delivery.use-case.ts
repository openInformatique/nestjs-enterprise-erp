import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { StockMovementType } from '../../stock/domain/stock-movement-type.enum';
import { STOCK_LEVEL_REPOSITORY } from '../../stock/domain/stock-level-repository.port';
import type { StockLevelRepositoryPort } from '../../stock/domain/stock-level-repository.port';
import { STOCK_WRITER } from '../../stock/domain/stock-writer.port';
import type {
  NewStockMovementData,
  StockLevelWrite,
  StockWriterPort,
} from '../../stock/domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from '../../stock/domain/warehouse-repository.port';
import type { WarehouseRepositoryPort } from '../../stock/domain/warehouse-repository.port';
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';
import { CollectStockLinesHelper } from './collect-stock-lines.helper';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/** Options de départ en livraison. */
export interface StartDeliveryInput {
  /** Entrepôt de sortie — OBLIGATOIRE si la commande a des lignes stockées. */
  warehouseId?: string;
}

/**
 * Cas d'utilisation : départ en livraison (CONFIRMED -> IN_PROGRESS).
 *
 * Commande CUSTOMER : le stock SORT, en une seule écriture atomique
 * (mouvements + niveaux via StockWriter). Vérifications AVANT toute
 * écriture : quantités agrégées par produit, chaque produit doit être
 * disponible — sinon 409 et RIEN ne bouge.
 *
 * Commande SUPPLIER : simple transition (le stock entrera à la
 * réception, voir CompleteOrderUseCase).
 */
@Injectable()
export class StartDeliveryUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly collectStockLinesHelper: CollectStockLinesHelper,
    @Inject(WAREHOUSE_REPOSITORY)
    private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    orderId: string,
    input: StartDeliveryInput,
  ): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isConfirmed()) {
      throw new BusinessRuleViolationException(
        `Seule une commande confirmée peut partir en livraison (statut ` +
          `actuel : ${order.status}).`,
      );
    }

    let warehouseId: string | null = null;

    if (order.type === OrderType.Customer) {
      const stockLines = await this.collectStockLinesHelper.collect(order);

      if (stockLines.length > 0) {
        warehouseId = await this.resolveWarehouse(input.warehouseId);

        // Vérification APRÈS agrégation : deux lignes du même produit
        // sont une seule demande cumulée.
        const needed =
          this.collectStockLinesHelper.aggregateByProduct(stockLines);
        const newLevels: StockLevelWrite[] = [];
        for (const [productId, quantity] of needed) {
          const level = await this.stockLevelRepository.findOne(
            productId,
            warehouseId,
          );
          const available = level?.quantity ?? 0;
          if (available < quantity) {
            throw new BusinessRuleViolationException(
              `Stock insuffisant pour livrer ${order.number} : ` +
                `${available} disponible(s), ${quantity} demandé(s) ` +
                `(produit ${productId}).`,
            );
          }
          newLevels.push({
            productId,
            warehouseId,
            quantity: available - quantity,
          });
        }

        // Un mouvement OUT par ligne (traçabilité fine), les niveaux
        // agrégés par produit — le tout dans UNE transaction.
        const performedAt = new Date();
        const movements: NewStockMovementData[] = stockLines.map((line) => ({
          productId: line.productId,
          warehouseId: warehouseId as string,
          targetWarehouseId: null,
          type: StockMovementType.Out,
          quantity: line.quantity,
          unitCost: null,
          reference: order.number,
          notes: `Livraison ${order.number} — ${line.description}`,
          performedBy: actor.userId,
          performedAt,
        }));

        await this.stockWriter.write(movements, newLevels);
      }
    }

    return this.orderRepository.update(orderId, {
      status: OrderStatus.InProgress,
      // Mémorisé pour savoir OÙ réinjecter en cas d'annulation.
      warehouseId,
    });
  }

  /** L'entrepôt de sortie doit être fourni, exister et être actif. */
  private async resolveWarehouse(warehouseId?: string): Promise<string> {
    if (warehouseId === undefined) {
      throw new BusinessRuleViolationException(
        'Cette commande contient des produits stockés : précisez ' +
          "l'entrepôt de sortie (warehouseId).",
      );
    }
    const warehouse = await this.warehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new ResourceNotFoundException("L'entrepôt");
    }
    if (!warehouse.isActive) {
      throw new BusinessRuleViolationException(
        `L'entrepôt ${warehouse.code} est désactivé : aucun mouvement possible.`,
      );
    }
    return warehouse.id;
  }
}
