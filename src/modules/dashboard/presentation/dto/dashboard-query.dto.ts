import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Query string de GET /dashboard.
 * @Type(() => Number) : la conversion implicite est désactivée dans le
 * ValidationPipe global (comme pour la pagination du socle) — sans lui,
 * "5" resterait une chaîne et IsInt refuserait.
 */
export class DashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Seuil des alertes de stock (quantité strictement inférieure).',
    default: 5,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Le paramètre "stockAlertThreshold" doit être un entier.',
  })
  @Min(0, {
    message: 'Le paramètre "stockAlertThreshold" ne peut pas être négatif.',
  })
  stockAlertThreshold?: number;
}
