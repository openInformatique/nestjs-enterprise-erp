import { ApiProperty } from '@nestjs/swagger';
import { TransferResult } from '../../application/transfer-stock.use-case';

/** Un côté du transfert : l'entrepôt et sa nouvelle quantité. */
export class TransferredLevelDto {
  @ApiProperty()
  warehouseId!: string;

  @ApiProperty({ description: 'Quantité APRÈS transfert.' })
  quantity!: number;
}

/** Réponse de POST /stock/transfer : les deux niveaux mis à jour. */
export class TransferResultDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ type: TransferredLevelDto })
  from!: TransferredLevelDto;

  @ApiProperty({ type: TransferredLevelDto })
  to!: TransferredLevelDto;

  static fromResult(result: TransferResult): TransferResultDto {
    const dto = new TransferResultDto();
    dto.productId = result.productId;
    dto.from = { ...result.from };
    dto.to = { ...result.to };
    return dto;
  }
}
