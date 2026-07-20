import { ApiProperty } from '@nestjs/swagger';
import { OrderLine } from '../../domain/order-line';

/** Représentation publique d'une ligne de commande. */
export class OrderLineResponseDto {
  @ApiProperty({ description: 'Identifiant de la ligne (UUID).' })
  id!: string;

  @ApiProperty({ nullable: true, description: 'null = ligne libre.' })
  productId!: string | null;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  description!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ description: 'Prix unitaire HT figé.', example: 349.9 })
  unitPrice!: number;

  @ApiProperty({ example: 20 })
  vatRate!: number;

  @ApiProperty({ description: 'qté × prix, au centime.', example: 699.8 })
  subtotalHT!: number;

  static fromDomain(line: OrderLine): OrderLineResponseDto {
    const dto = new OrderLineResponseDto();
    dto.id = line.id;
    dto.productId = line.productId;
    dto.description = line.description;
    dto.quantity = line.quantity;
    dto.unitPrice = line.unitPrice;
    dto.vatRate = line.vatRate;
    dto.subtotalHT = line.subtotalHT;
    return dto;
  }
}
