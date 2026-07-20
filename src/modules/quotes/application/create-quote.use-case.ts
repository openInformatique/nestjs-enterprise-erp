import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetContactByIdUseCase } from '../../contact/application/get-contact-by-id.use-case';
import { Quote } from '../domain/quote';
import { QUOTE_REPOSITORY } from '../domain/quote-repository.port';
import type { QuoteRepositoryPort } from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';
import { computeQuoteTotals } from '../domain/quote-totals';
import {
  QuoteLineInput,
  ResolveQuoteLinesHelper,
} from './resolve-quote-lines.helper';

/** Durée de validité par défaut d'un devis (jours). */
const DEFAULT_VALIDITY_DAYS = 30;

/** Données de création (déjà validées par le DTO). */
export interface CreateQuoteInput {
  customerId: string;
  validUntil?: string;
  notes?: string;
  lines: QuoteLineInput[];
}

/**
 * Cas d'utilisation : créer un devis (statut DRAFT).
 *
 * Règles :
 *   - le contact doit être un CLIENT (CUSTOMER ou BOTH) ;
 *   - lignes résolues (produit actif copié / ligne libre complète) ;
 *   - totaux calculés CÔTÉ SERVEUR — jamais confiés au client ;
 *   - numéro généré (DEV-YYYY-NNNN), validité par défaut : +30 jours.
 */
@Injectable()
export class CreateQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly quoteRepository: QuoteRepositoryPort,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveQuoteLinesHelper: ResolveQuoteLinesHelper,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateQuoteInput,
  ): Promise<Quote> {
    const contact = await this.getContactByIdUseCase.execute(input.customerId);
    if (!contact.isCustomer()) {
      throw new BusinessRuleViolationException(
        `Le contact « ${contact.companyName} » n'est pas un client ` +
          '(type CUSTOMER ou BOTH requis).',
      );
    }

    const lines = await this.resolveQuoteLinesHelper.resolve(input.lines);
    const totals = computeQuoteTotals(lines);

    const validUntil = input.validUntil
      ? new Date(input.validUntil)
      : new Date(Date.now() + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    return this.quoteRepository.create({
      number: await this.quoteRepository.nextNumber(),
      customerId: input.customerId,
      status: QuoteStatus.Draft,
      validUntil,
      notes: input.notes ?? null,
      ...totals,
      createdBy: actor.userId,
      lines,
    });
  }
}
