import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { QuoteStatus } from '../../domain/quote-status.enum';

/**
 * Query string de GET /quotes.
 * IntersectionType combine la pagination du socle ET la plage de dates
 * (from/to sur la date de CRÉATION du devis) — même pattern qu'au
 * module 04 pour l'historique des mouvements.
 */
export class ListQuotesQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus, {
    message:
      'Le statut doit valoir DRAFT, SENT, ACCEPTED, REJECTED ou EXPIRED.',
  })
  status?: QuoteStatus;

  @ApiPropertyOptional({ description: 'Filtre par client.' })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "customerId" doit être un UUID valide.',
  })
  customerId?: string;
}
