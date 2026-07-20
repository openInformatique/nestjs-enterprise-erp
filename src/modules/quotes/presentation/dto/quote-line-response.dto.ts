import { ApiProperty } from '@nestjs/swagger';
import { QuoteLine } from '../../domain/quote-line';

/** Représentation publique d'une ligne de devis. */
export class QuoteLineResponseDto {
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

  @ApiProperty({ example: 10 })
  discountPercent!: number;

  @ApiProperty({
    description: 'qté × prix × (1 - remise/100).',
    example: 629.82,
  })
  subtotalHT!: number;

  static fromDomain(line: QuoteLine): QuoteLineResponseDto {
    const dto = new QuoteLineResponseDto();
    dto.id = line.id;
    dto.productId = line.productId;
    dto.description = line.description;
    dto.quantity = line.quantity;
    dto.unitPrice = line.unitPrice;
    dto.vatRate = line.vatRate;
    dto.discountPercent = line.discountPercent;
    dto.subtotalHT = line.subtotalHT;
    return dto;
  }
}
