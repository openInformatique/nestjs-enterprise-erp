import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { AuditCategory } from '../../domain/audit-category.enum';

/**
 * Query de GET /audit-logs.
 * `sortBy` et `search`, hérités de PaginationQueryDto, sont IGNORÉS ici :
 * le journal se filtre par ressource/acteur/action/catégorie/période,
 * jamais par tri libre ni recherche plein texte — un choix volontaire,
 * comme l'absence de recherche textuelle au module 08 (paiements).
 */
export class ListAuditLogsQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ example: 'invoice' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, {
    message: 'Le paramètre "actorUserId" doit être un UUID valide.',
  })
  actorUserId?: string;

  @ApiPropertyOptional({ example: 'payments.recorded' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ enum: AuditCategory })
  @IsOptional()
  @IsEnum(AuditCategory, {
    message: 'La catégorie doit valoir TECHNICAL, BUSINESS, SECURITY ou AUDIT.',
  })
  category?: AuditCategory;
}
