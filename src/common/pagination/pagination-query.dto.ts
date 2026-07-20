import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_MAX_LIMIT,
} from './pagination.constants';
import { SortDirection } from './sort-direction.enum';

/**
 * Paramètres de requête communs aux listes paginées.
 *
 * Les modules l'étendent au besoin (filtres spécifiques). Le tri n'est
 * appliqué que si la colonne figure dans la liste blanche du module
 * (voir TypeOrmFilterHelper.applySort).
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Numéro de page (à partir de 1).',
    default: PAGINATION_DEFAULT_PAGE,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le paramètre "page" doit être un entier.' })
  @Min(1, { message: 'Le paramètre "page" doit être supérieur ou égal à 1.' })
  page: number = PAGINATION_DEFAULT_PAGE;

  @ApiPropertyOptional({
    description: 'Nombre d’éléments par page.',
    default: PAGINATION_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PAGINATION_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le paramètre "limit" doit être un entier.' })
  @Min(1, { message: 'Le paramètre "limit" doit être supérieur ou égal à 1.' })
  @Max(PAGINATION_MAX_LIMIT, {
    message: `Le paramètre "limit" ne peut pas dépasser ${PAGINATION_MAX_LIMIT}.`,
  })
  limit: number = PAGINATION_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description:
      'Colonne de tri (uniquement parmi la liste blanche du module).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Direction du tri.',
    enum: SortDirection,
    default: SortDirection.Asc,
  })
  @IsOptional()
  @IsEnum(SortDirection, {
    message: 'Le paramètre "sortDirection" doit valoir "ASC" ou "DESC".',
  })
  sortDirection: SortDirection = SortDirection.Asc;

  @ApiPropertyOptional({
    description: 'Recherche textuelle (colonnes définies par le module).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  /** Décalage SQL calculé à partir de la page et de la limite. */
  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}
