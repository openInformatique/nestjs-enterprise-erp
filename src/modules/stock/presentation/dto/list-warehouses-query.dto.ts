import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query string de GET /warehouses (liste courte : pas de pagination). */
export class ListWarehousesQueryDto {
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
