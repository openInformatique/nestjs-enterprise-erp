import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type {
  ListQuotesQuery,
  QuoteRepositoryPort,
} from '../domain/quote-repository.port';

/** Cas d'utilisation : lister les devis (pagination + filtres). */
@Injectable()
export class ListQuotesUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
  ) {}

  execute(query: ListQuotesQuery): Promise<PaginatedResult<Quote>> {
    return this.quoteRepository.findAll(query);
  }
}
