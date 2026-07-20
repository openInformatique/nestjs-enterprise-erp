import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { ExportFormat } from '../../../../common/enums/export-format.enum';
import { PaymentMethod } from '../../domain/payment-method.enum';

/** Query de GET /payments/export — les filtres habituels, SANS pagination. */
export class ExportPaymentsQueryDto extends IntersectionType(DateRangeDto) {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: "L'invoiceId doit être un UUID valide." })
  invoiceId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message:
      'La méthode doit valoir BANK_TRANSFER, CARD, CASH, CHECK ou OTHER.',
  })
  method?: PaymentMethod;
}
