import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/**
 * Filtre commun de plage de dates (bornes INCLUSES).
 *
 * Le champ daté sur lequel portent les bornes est choisi par chaque
 * module (date de création, date de mouvement...) : ce DTO ne fait que
 * valider le format et documenter Swagger de façon uniforme.
 *
 * Usage — à combiner avec la pagination via IntersectionType :
 *
 *   export class ListXxxQueryDto extends IntersectionType(
 *     PaginationQueryDto,
 *     DateRangeDto,
 *   ) { ... filtres propres au module ... }
 *
 * Une query string est toujours du texte : la conversion en Date reste
 * à la charge de l'appelant (new Date(query.from)), le format ISO ayant
 * déjà été garanti ici.
 */
export class DateRangeDto {
  @ApiPropertyOptional({
    description: 'Début de période (ISO 8601, inclus).',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Le paramètre "from" doit être une date ISO 8601.' },
  )
  from?: string;

  @ApiPropertyOptional({
    description: 'Fin de période (ISO 8601, incluse).',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Le paramètre "to" doit être une date ISO 8601.' },
  )
  to?: string;
}
