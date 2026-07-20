import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';

/**
 * Cas d'utilisation : envoyer un devis (DRAFT -> SENT).
 *
 * Version minimale : uniquement la transition de statut. La génération
 * du PDF et l'e-mail au client (avec pièce jointe) sont branchés au
 * niveau min- — la transition, elle, ne changera pas.
 */
@Injectable()
export class SendQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
  ) {}

  async execute(quoteId: string): Promise<Quote> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);
    if (!quote.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seul un devis en brouillon peut être envoyé (statut actuel : ` +
          `${quote.status}).`,
      );
    }

    await this.quoteRepository.updateStatus(quoteId, QuoteStatus.Sent);
    return this.getQuoteByIdUseCase.execute(quoteId);
  }
}
