import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { ContactType } from '../../domain/contact-type.enum';

/**
 * Query string de GET /contacts.
 * Hérite des paramètres communs du socle (page, limit, sortBy,
 * sortDirection, search).
 */
export class ListContactsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtre par nature du contact.',
    enum: ContactType,
  })
  @IsOptional()
  @IsEnum(ContactType, {
    message: 'Le paramètre "type" doit valoir CUSTOMER, SUPPLIER ou BOTH.',
  })
  type?: ContactType;

  @ApiPropertyOptional({
    description: 'Filtre par statut (true = actifs, false = désactivés).',
  })
  @IsOptional()
  // Une query string est toujours du texte : conversion manuelle
  // (NE PAS utiliser @Type(() => Boolean) : "false" deviendrait true).
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({
    message: 'Le paramètre "isActive" doit valoir true ou false.',
  })
  isActive?: boolean;
}
