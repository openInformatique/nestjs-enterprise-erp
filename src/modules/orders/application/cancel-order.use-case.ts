import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
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
import { Order } from '../domain/order';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';
import { CollectStockLinesHelper } from './collect-stock-lines.helper';
import { GetOrderByIdUseCase } from './get-order-by-id.use-case';

/**
 * Cas d'utilisation : annuler une commande.
 *
 * Autorisé depuis tout statut SAUF DELIVERED (une commande livrée se
 * traite par avoir, module 07) et CANCELLED (déjà annulée).
 *
 * L'ÉCRITURE COMPENSATRICE : si une commande CLIENT était partie en
 * livraison, son stock est déjà sorti — on ne « supprime » pas les
 * mouvements (journal immuable), on écrit les mouvements INVERSES
 * (IN, référence ANNULATION CMD-XXXX). L'historique raconte toute
 * l'histoire : sorti, puis réinjecté.
 */
@Injectable()
export class CancelOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly collectStockLinesHelper: CollectStockLinesHelper,
    @Inject(STOCK_LEVEL_REPOSITORY)
    private readonly stockLevelRepository: StockLevelRepositoryPort,
    @Inject(STOCK_WRITER)
    private readonly stockWriter: StockWriterPort,
  ) {}

  async execute(actor: AuthenticatedUser, orderId: string): Promise<Order> {
    const order = await this.getOrderByIdUseCase.execute(orderId);
    if (!order.isCancellable()) {
      throw new BusinessRuleViolationException(
        order.status === OrderStatus.Delivered
          ? 'Une commande livrée ne peut plus être annulée (un avoir ' +
              'sera possible au module 07).'
          : 'Cette commande est déjà annulée.',
      );
    }

    // Réinjection : uniquement si le stock était réellement sorti
    // (commande CLIENT partie en livraison).
    if (order.type === OrderType.Customer && order.isInProgress()) {
      const stockLines = await this.collectStockLinesHelper.collect(order);

      if (stockLines.length > 0) {
        // Posé au départ en livraison — ne peut pas être null si des
        // lignes stockées existent.
        const warehouseId = order.warehouseId as string;

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
          warehouseId,
          targetWarehouseId: null,
          type: StockMovementType.In,
          quantity: line.quantity,
          unitCost: null,
          reference: `ANNULATION ${order.number}`,
          notes: `Réinjection suite à l'annulation de ${order.number} — ${line.description}`,
          performedBy: actor.userId,
          performedAt,
        }));

        await this.stockWriter.write(movements, newLevels);
      }
    }

    return this.orderRepository.update(orderId, {
      status: OrderStatus.Cancelled,
    });
  }
}
