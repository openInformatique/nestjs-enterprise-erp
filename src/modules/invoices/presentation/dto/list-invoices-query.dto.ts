import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { InvoiceStatus } from '../../domain/invoice-status.enum';
import { InvoiceType } from '../../domain/invoice-type.enum';

/**
 * Query string de GET /invoices — pagination + plage de dates (from/to
 * sur la date d'ÉMISSION) via IntersectionType.
 */
export class ListInvoicesQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
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
      'Le statut doit valoir DRAFT, SENT, PARTIALLY_PAID, PAID, ' +
      'OVERDUE ou CANCELLED.',
  })
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Filtre par client.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "customerId" doit être un UUID valide.',
  })
  customerId?: string;
}
