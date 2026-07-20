import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';

/** Cas d'utilisation : refuser un devis (SENT -> REJECTED). */
@Injectable()
export class RejectQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
  ) {}

  async execute(quoteId: string): Promise<Quote> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);
    if (!quote.isSent()) {
      throw new BusinessRuleViolationException(
        `Seul un devis envoyé peut être refusé (statut actuel : ` +
          `${quote.status}).`,
      );
    }

    await this.quoteRepository.updateStatus(quoteId, QuoteStatus.Rejected);
    return this.getQuoteByIdUseCase.execute(quoteId);
  }
}
