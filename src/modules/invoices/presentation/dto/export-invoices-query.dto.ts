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
import { InvoiceStatus } from '../../domain/invoice-status.enum';
import { InvoiceType } from '../../domain/invoice-type.enum';

/** Query de GET /invoices/export — les filtres habituels, SANS pagination. */
export class ExportInvoicesQueryDto extends IntersectionType(DateRangeDto) {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional({ enum: InvoiceType })
  @IsOptional()
  @IsEnum(InvoiceType, {
    message: 'Le type doit valoir INVOICE ou CREDIT_NOTE.',
  })
  type?: InvoiceType;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus, {
    message:
      'Le statut doit valoir DRAFT, SENT, PARTIALLY_PAID, PAID, OVERDUE ou CANCELLED.',
  })
  status?: InvoiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: 'Le customerId doit être un UUID valide.' })
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
