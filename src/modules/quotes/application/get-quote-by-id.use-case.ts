import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';

/** Cas d'utilisation : récupérer un devis complet (404 si inconnu). */
@Injectable()
export class GetQuoteByIdUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
  ) {}

  async execute(quoteId: string): Promise<Quote> {
    const quote = await this.quoteRepository.findById(quoteId);
    if (!quote) {
      throw new ResourceNotFoundException('Le devis');
    }
    return quote;
  }
}
