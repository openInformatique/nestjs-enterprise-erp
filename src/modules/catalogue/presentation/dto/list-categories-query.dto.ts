import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query string de GET /categories (liste courte : pas de pagination). */
export class ListCategoriesQueryDto {
  @ApiPropertyOptional({
    description: 'Filtre par statut (true = actives, false = désactivées).',
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
