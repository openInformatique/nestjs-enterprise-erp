import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GlobalSearchUseCase } from '../application/global-search.use-case';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';

/** Contrôleur de recherche globale — ouvert à tout utilisateur connecté. */
@ApiTags('Recherche')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly globalSearchUseCase: GlobalSearchUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Recherche globale',
    description:
      'Contacts, produits, commandes, factures — 5 résultats par type ' +
      '(20 au total). `q` : 2 caractères minimum. `types` filtre les ' +
      'catégories cherchées.',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  async search(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    const results = await this.globalSearchUseCase.execute(
      query.q,
      query.types,
    );
    return SearchResponseDto.fromResults(query.q, results);
  }
}
