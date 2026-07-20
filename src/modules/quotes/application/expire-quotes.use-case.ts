import { Inject, Injectable } from '@nestjs/common';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';

/**
 * Cas d'utilisation : faire expirer les devis dépassés.
 * Appelé par la tâche planifiée (étape 8) : tous les devis SENT dont
 * validUntil est passée basculent en EXPIRED. Idempotent : zéro devis
 * à expirer est un résultat normal.
 */
@Injectable()
export class ExpireQuotesUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
  ) {}

  /** Renvoie le nombre de devis expirés. */
  async execute(): Promise<number> {
    const expired = await this.quoteRepository.findExpired(new Date());

    for (const quote of expired) {
      await this.quoteRepository.updateStatus(quote.id, QuoteStatus.Expired);
    }

    return expired.length;
  }
}
