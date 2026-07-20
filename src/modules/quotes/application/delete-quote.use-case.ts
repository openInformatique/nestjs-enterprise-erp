import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';

/**
 * Cas d'utilisation : supprimer un devis — BROUILLON UNIQUEMENT.
 * Suppression physique : un brouillon n'engage personne. Un devis
 * envoyé, lui, ne se supprime JAMAIS (il se refuse ou expire).
 */
@Injectable()
export class DeleteQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
  ) {}

  async execute(quoteId: string): Promise<void> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);
    if (!quote.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seul un devis en brouillon peut être supprimé (statut actuel : ` +
          `${quote.status}).`,
      );
    }

    await this.quoteRepository.delete(quoteId);
  }
}
