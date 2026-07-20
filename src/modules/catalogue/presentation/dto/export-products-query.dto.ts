import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ExportFormat } from '../../../../common/enums/export-format.enum';
import { ProductType } from '../../domain/product-type.enum';

/** Query de GET /products/export — les filtres habituels, SANS pagination. */
export class ExportProductsQueryDto {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType, { message: 'Le type doit valoir PRODUCT ou SERVICE.' })
  type?: ProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: 'Le categoryId doit être un UUID valide.' })
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
