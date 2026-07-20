import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';

/** Query string de GET /stock (hérite de la pagination du socle). */
export class ListStockLevelsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtre par produit.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "productId" doit être un UUID valide.',
  })
  productId?: string;

  @ApiPropertyOptional({ description: 'Filtre par entrepôt.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "warehouseId" doit être un UUID valide.',
  })
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'true = uniquement les stocks bas (quantité < 5).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({
    message: 'Le paramètre "lowStock" doit valoir true ou false.',
  })
  lowStock?: boolean;
}
