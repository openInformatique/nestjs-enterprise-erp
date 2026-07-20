import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { ProductType } from '../../domain/product-type.enum';

/** Query string de GET /products (hérite de la pagination du socle). */
export class ListProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtre par catégorie.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "categoryId" doit être un UUID valide.',
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filtre par nature (bien physique ou prestation).',
    enum: ProductType,
  })
  @IsOptional()
  @IsEnum(ProductType, {
    message: 'Le paramètre "type" doit valoir PRODUCT ou SERVICE.',
  })
  type?: ProductType;

  @ApiPropertyOptional({
    description: 'Filtre par statut (true = actifs, false = désactivés).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({
    message: 'Le paramètre "isActive" doit valoir true ou false.',
  })
  isActive?: boolean;
}
