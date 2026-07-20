import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../../domain/order';
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';
import { OrderLineResponseDto } from './order-line-response.dto';

/**
 * Représentation publique d'une commande.
 * Dans les listes, `lines` est un tableau vide (le détail les charge).
 */
export class OrderResponseDto {
  @ApiProperty({ description: 'Identifiant de la commande (UUID).' })
  id!: string;

  @ApiProperty({ example: 'CMD-2026-0001' })
  number!: string;

  @ApiProperty({ enum: OrderType })
  type!: OrderType;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty()
  contactId!: string;

  @ApiProperty({ example: 'ACME Industries' })
  contactName!: string;

  @ApiProperty({
    nullable: true,
    description: 'Devis d’origine si la commande vient d’une conversion.',
  })
  quoteId!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Entrepôt de livraison/réception (posé par les transitions).',
  })
  warehouseId!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: [OrderLineResponseDto] })
  lines!: OrderLineResponseDto[];

  @ApiProperty({ example: 699.8 })
  totalHT!: number;

  @ApiProperty({ example: 139.96 })
  totalVAT!: number;

  @ApiProperty({ example: 839.76 })
  totalTTC!: number;

  @ApiProperty({ nullable: true })
  expectedDeliveryDate!: Date | null;

  @ApiProperty({ nullable: true, description: 'Posée à la clôture.' })
  deliveredAt!: Date | null;

  @ApiProperty({ nullable: true, description: 'UUID du créateur.' })
  createdBy!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(order: Order): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.number = order.number;
    dto.type = order.type;
    dto.status = order.status;
    dto.contactId = order.contactId;
    dto.contactName = order.contactName;
    dto.quoteId = order.quoteId;
    dto.warehouseId = order.warehouseId;
    dto.notes = order.notes;
    dto.lines = order.lines.map(OrderLineResponseDto.fromDomain);
    dto.totalHT = order.totalHT;
    dto.totalVAT = order.totalVAT;
    dto.totalTTC = order.totalTTC;
    dto.expectedDeliveryDate = order.expectedDeliveryDate;
    dto.deliveredAt = order.deliveredAt;
    dto.createdBy = order.createdBy;
    dto.createdAt = order.createdAt;
    dto.updatedAt = order.updatedAt;
    return dto;
  }
}
