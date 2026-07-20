import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWarehouseDto } from './create-warehouse.dto';

/**
 * Corps de PATCH /warehouses/:id — tout optionnel + isActive.
 * isActive: false est REFUSÉ par le use case (la désactivation passe
 * par DELETE, qui vérifie que l'entrepôt est vide).
 */
export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {
  @ApiPropertyOptional({
    description: 'true pour réactiver. false refusé : passer par DELETE.',
  })
  @IsOptional()
  @IsBoolean({ message: 'Le champ "isActive" doit valoir true ou false.' })
  isActive?: boolean;
}
