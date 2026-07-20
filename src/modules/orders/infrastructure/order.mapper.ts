import { Injectable } from '@nestjs/common';
import { Order } from '../domain/order';
import { OrderLine } from '../domain/order-line';
import { OrderEntity } from './entities/order.entity';
import { OrderLineEntity } from './entities/order-line.entity';

/** Conversion entités TypeORM -> modèles de domaine. */
@Injectable()
export class OrderMapper {
  toDomain(entity: OrderEntity): Order {
    const lines = [...(entity.lines ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((line) => this.lineToDomain(line));

    return new Order(
      entity.id,
      entity.number,
      entity.type,
      entity.contactId,
      entity.contact?.companyName ?? '',
      entity.status,
      entity.quoteId,
      entity.warehouseId,
      entity.notes,
      entity.totalHT,
      entity.totalVAT,
      entity.totalTTC,
      entity.expectedDeliveryDate,
      entity.deliveredAt,
      entity.createdBy,
      entity.createdAt,
      entity.updatedAt,
      lines,
    );
  }

  private lineToDomain(entity: OrderLineEntity): OrderLine {
    return new OrderLine(
      entity.id,
      entity.orderId,
      entity.productId,
      entity.description,
      entity.quantity,
      entity.unitPrice,
      entity.vatRate,
      entity.subtotalHT,
    );
  }
}
