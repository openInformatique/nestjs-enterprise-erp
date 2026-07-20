import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Corps (optionnel) de POST /orders/:id/start. */
export class StartDeliveryDto {
  @ApiPropertyOptional({
    description:
      'Entrepôt de SORTIE du stock — obligatoire si la commande ' +
      '(CUSTOMER) contient des produits stockés.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le warehouseId doit être un UUID valide.',
  })
  warehouseId?: string;
}
