import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { StockMovementType } from '../../domain/stock-movement-type.enum';

/**
 * Query string de GET /stock/movements.
 *
 * IntersectionType fusionne DEUX DTOs du socle : la pagination ET la
 * plage de dates (from/to sur performedAt) — TypeScript n'autorise
 * qu'un seul extends, ce helper de @nestjs/swagger combine les
 * validations et la doc des deux.
 */
export class ListStockMovementsQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ description: 'Filtre par produit.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "productId" doit être un UUID valide.',
  })
  productId?: string;

  @ApiPropertyOptional({ description: 'Filtre par entrepôt (source).' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "warehouseId" doit être un UUID valide.',
  })
  warehouseId?: string;

  @ApiPropertyOptional({ enum: StockMovementType })
  @IsOptional()
  @IsEnum(StockMovementType, {
    message: 'Le type doit valoir IN, OUT, ADJUSTMENT ou TRANSFER.',
  })
  type?: StockMovementType;
}
