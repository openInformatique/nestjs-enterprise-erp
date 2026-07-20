import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';

/**
 * Query string de GET /orders — pagination + plage de dates (from/to
 * sur la date de création) via IntersectionType, comme aux modules
 * 04 et 05.
 */
export class ListOrdersQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ enum: OrderType })
  @IsOptional()
  @IsEnum(OrderType, {
    message: 'Le type doit valoir CUSTOMER ou SUPPLIER.',
  })
  type?: OrderType;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus, {
    message:
      'Le statut doit valoir DRAFT, CONFIRMED, IN_PROGRESS, DELIVERED ' +
      'ou CANCELLED.',
  })
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Filtre par contact.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "contactId" doit être un UUID valide.',
  })
  contactId?: string;
}
