import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Corps (optionnel) de POST /orders/:id/complete. */
export class CompleteOrderDto {
  @ApiPropertyOptional({
    description:
      'Entrepôt de RÉCEPTION du stock — obligatoire si la commande ' +
      '(SUPPLIER) contient des produits stockés.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId?: string;
}
