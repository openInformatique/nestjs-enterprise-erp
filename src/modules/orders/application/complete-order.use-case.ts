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

/** Options de clôture de livraison. */
export interface CompleteOrderInput {
  /** Entrepôt de réception — OBLIGATOIRE si commande SUPPLIER avec
   *  produits stockés. */
  warehouseId?: string;
}

/**
 * Cas d'utilisation : clôturer la livraison (IN_PROGRESS -> DELIVERED).
 *
 * Commande SUPPLIER : la marchandise ARRIVE — entrées de stock avec le
 * prix d'achat de la ligne comme unitCost du mouvement (le coût entre
 * dans l'historique).
 * Commande CUSTOMER : simple transition (le stock est déjà sorti au
 * départ en livraison) + deliveredAt posé.
 */
@Injectable()
export class CompleteOrderUseCase {
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
    input: CompleteOrderInput,
  ): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isInProgress()) {
      throw new BusinessRuleViolationException(
        `Seule une commande en cours de livraison peut être clôturée ` +
          `(statut actuel : ${order.status}).`,
      );
    }

    let warehouseId: string | null = order.warehouseId;

    if (order.type === OrderType.Supplier) {
      const stockLines = await this.collectStockLinesHelper.collect(order);

      if (stockLines.length > 0) {
        warehouseId = await this.resolveWarehouse(input.warehouseId);

        const needed =
          this.collectStockLinesHelper.aggregateByProduct(stockLines);
        const newLevels: StockLevelWrite[] = [];
        for (const [productId, quantity] of needed) {
          const level = await this.stockLevelRepository.findOne(
            productId,
            warehouseId,
          );
          newLevels.push({
            productId,
            warehouseId,
            quantity: (level?.quantity ?? 0) + quantity,
          });
        }

        const performedAt = new Date();
        const movements: NewStockMovementData[] = stockLines.map((line) => ({
          productId: line.productId,
          warehouseId: warehouseId as string,
          targetWarehouseId: null,
          type: StockMovementType.In,
          quantity: line.quantity,
          // Le prix d'achat de la ligne devient le coût du mouvement.
          unitCost: line.unitPrice,
          reference: order.number,
          notes: `Réception ${order.number} — ${line.description}`,
          performedBy: actor.userId,
          performedAt,
        }));

        await this.stockWriter.write(movements, newLevels);
      }
    }

    return this.orderRepository.update(orderId, {
      status: OrderStatus.Delivered,
      deliveredAt: new Date(),
      warehouseId,
    });
  }

  /** L'entrepôt de réception doit être fourni, exister et être actif. */
  private async resolveWarehouse(warehouseId?: string): Promise<string> {
    if (warehouseId === undefined) {
      throw new BusinessRuleViolationException(
        'Cette commande contient des produits stockés : précisez ' +
          "l'entrepôt de réception (warehouseId).",
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
