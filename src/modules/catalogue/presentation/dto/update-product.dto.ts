import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

/** Corps de PATCH /products/:id — tout optionnel + isActive. */
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({
    description: 'Réactive (true) ou désactive (false) le produit.',
  })
  @IsOptional()
  @IsBoolean({ message: 'Le champ "isActive" doit valoir true ou false.' })
  isActive?: boolean;
}
