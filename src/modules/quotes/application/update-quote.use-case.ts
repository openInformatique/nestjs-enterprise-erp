import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetContactByIdUseCase } from '../../contact/application/get-contact-by-id.use-case';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type {
  QuoteRepositoryPort,
  UpdateQuoteData,
} from '../domain/quote-repository.port';
import { computeQuoteTotals } from '../domain/quote-totals';
import { GetQuoteByIdUseCase } from './get-quote-by-id.use-case';
import {
  QuoteLineInput,
  ResolveQuoteLinesHelper,
} from './resolve-quote-lines.helper';

/** Champs modifiables (sémantique PATCH ; lines = remplacement complet). */
export interface UpdateQuoteInput {
  customerId?: string;
  validUntil?: string;
  notes?: string;
  lines?: QuoteLineInput[];
}

/**
 * Cas d'utilisation : modifier un devis — BROUILLON UNIQUEMENT.
 * Si les lignes sont fournies, elles REMPLACENT toutes les anciennes
 * et les totaux sont recalculés.
 */
@Injectable()
export class UpdateQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveQuoteLinesHelper: ResolveQuoteLinesHelper,
  ) {}

  async execute(quoteId: string, input: UpdateQuoteInput): Promise<Quote> {
    const quote = await this.getQuoteByIdUseCase.execute(quoteId);
    if (!quote.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seul un devis en brouillon est modifiable (statut actuel : ` +
          `${quote.status}).`,
      );
    }

    const changes: UpdateQuoteData = {};

    if (input.customerId !== undefined) {
      const contact = await this.getContactByIdUseCase.execute(
        input.customerId,
      );
      if (!contact.isCustomer()) {
        throw new BusinessRuleViolationException(
          `Le contact « ${contact.companyName} » n'est pas un client ` +
            '(type CUSTOMER ou BOTH requis).',
        );
      }
      changes.customerId = input.customerId;
    }

    if (input.validUntil !== undefined) {
      changes.validUntil = new Date(input.validUntil);
    }
    if (input.notes !== undefined) {
      changes.notes = input.notes;
    }

    if (input.lines !== undefined) {
      const lines = await this.resolveQuoteLinesHelper.resolve(input.lines);
      const totals = computeQuoteTotals(lines);
      changes.lines = lines;
      changes.totalHT = totals.totalHT;
      changes.totalVAT = totals.totalVAT;
      changes.totalTTC = totals.totalTTC;
    }

    return this.quoteRepository.update(quoteId, changes);
  }
}
