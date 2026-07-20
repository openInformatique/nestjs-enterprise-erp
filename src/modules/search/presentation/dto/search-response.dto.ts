import { ApiProperty } from '@nestjs/swagger';
import { SearchResult, SearchResultType } from '../../domain/search-result';

/** Représentation publique d'un résultat. */
export class SearchResultDto {
  @ApiProperty({ enum: SearchResultType })
  type!: SearchResultType;

  @ApiProperty({ description: 'Identifiant de la ressource (UUID).' })
  id!: string;

  @ApiProperty({ example: 'ACME Industries' })
  label!: string;

  @ApiProperty({ example: 'CUSTOMER' })
  subtitle!: string;

  @ApiProperty({
    description: 'Route FRONT-END (pas un endpoint de cette API).',
    example: '/contacts/3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  url!: string;

  static fromDomain(result: SearchResult): SearchResultDto {
    const dto = new SearchResultDto();
    dto.type = result.type;
    dto.id = result.id;
    dto.label = result.label;
    dto.subtitle = result.subtitle;
    dto.url = result.url;
    return dto;
  }
}

/** Réponse de GET /search : résultats groupés par type. */
export class SearchResponseDto {
  @ApiProperty({ example: 'dupont' })
  query!: string;

  @ApiProperty({
    description:
      'Résultats groupés par type ; une clé absente = aucun résultat de ce type.',
    example: {
      CONTACT: [],
      PRODUCT: [],
      ORDER: [],
      INVOICE: [],
    },
  })
  results!: Partial<Record<SearchResultType, SearchResultDto[]>>;

  @ApiProperty({
    description: 'Nombre total de résultats (tous types confondus).',
    example: 7,
  })
  total!: number;

  static fromResults(
    query: string,
    results: SearchResult[],
  ): SearchResponseDto {
    const dto = new SearchResponseDto();
    dto.query = query;
    dto.total = results.length;
    dto.results = {};
    for (const result of results) {
      const dtoResult = SearchResultDto.fromDomain(result);
      const bucket = dto.results[result.type] ?? [];
      bucket.push(dtoResult);
      dto.results[result.type] = bucket;
    }
    return dto;
  }
}
