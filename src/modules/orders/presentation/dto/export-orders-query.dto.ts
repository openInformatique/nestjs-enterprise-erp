import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { ExportFormat } from '../../../../common/enums/export-format.enum';
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';

/** Query de GET /orders/export — les filtres habituels, SANS pagination. */
export class ExportOrdersQueryDto extends IntersectionType(DateRangeDto) {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional({ enum: OrderType })
  @IsOptional()
  @IsEnum(OrderType, { message: 'Le type doit valoir CUSTOMER ou SUPPLIER.' })
  type?: OrderType;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus, {
    message:
      'Le statut doit valoir DRAFT, CONFIRMED, IN_PROGRESS, DELIVERED ou CANCELLED.',
  })
  status?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: 'Le contactId doit être un UUID valide.' })
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
