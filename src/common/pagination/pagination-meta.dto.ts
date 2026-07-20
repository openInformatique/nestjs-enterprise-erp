import { ApiProperty } from '@nestjs/swagger';

/**
 * Métadonnées de pagination renvoyées dans l'enveloppe standard
 * (meta.pagination).
 */
export class PaginationMetaDto {
  @ApiProperty({ description: 'Page courante.', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Éléments par page.', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Nombre total d’éléments.', example: 48 })
  totalItems!: number;

  @ApiProperty({ description: 'Nombre total de pages.', example: 3 })
  totalPages!: number;

  @ApiProperty({ description: 'Existe-t-il une page suivante ?' })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Existe-t-il une page précédente ?' })
  hasPreviousPage!: boolean;

  /** Construit les métadonnées à partir des totaux d'une requête. */
  static fromTotals(
    page: number,
    limit: number,
    totalItems: number,
  ): PaginationMetaDto {
    const meta = new PaginationMetaDto();
    meta.page = page;
    meta.limit = limit;
    meta.totalItems = totalItems;
    meta.totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
    meta.hasNextPage = page < meta.totalPages;
    meta.hasPreviousPage = page > 1;
    return meta;
  }
}
