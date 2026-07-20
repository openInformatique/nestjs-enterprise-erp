import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { PaymentMethod } from '../../domain/payment-method.enum';

/**
 * Query string de GET /payments — pagination + plage de dates (from/to
 * sur la date de VALEUR paidAt) via IntersectionType.
 */
export class ListPaymentsQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ description: 'Filtre par facture.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "invoiceId" doit être un UUID valide.',
  })
  invoiceId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message:
      'La méthode doit valoir BANK_TRANSFER, CARD, CASH, CHECK ou OTHER.',
  })
  method?: PaymentMethod;
}
