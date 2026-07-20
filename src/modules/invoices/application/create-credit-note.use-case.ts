import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceType } from '../domain/invoice-type.enum';
import { CreateInvoiceUseCase } from './create-invoice.use-case';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';
import { InvoiceLineInput } from './resolve-invoice-lines.helper';

/** Données de création d'un avoir. */
export interface CreateCreditNoteInput {
  /** Absentes : copie TOUTES les lignes de la source (avoir total).
   *  Fournies : avoir PARTIEL sur ces lignes uniquement. */
  lines?: InvoiceLineInput[];
  notes?: string;
}

/**
 * Cas d'utilisation : créer un AVOIR depuis une facture émise.
 *
 * L'avoir est une facture de type CREDIT_NOTE, numérotée AV-YYYY-NNNN,
 * liée à sa source par creditNoteForId. Montants en POSITIF (le type
 * porte le sens). La facture source ne change PAS de statut : le
 * rapprochement comptable (netting) appartient au module 08.
 */
@Injectable()
export class CreateCreditNoteUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    sourceInvoiceId: string,
    input: CreateCreditNoteInput,
  ): Promise<Invoice> {
    const source = await this.getInvoiceByIdUseCase.execute(sourceInvoiceId);

    if (!source.isCreditable()) {
      throw new BusinessRuleViolationException(
        source.type === InvoiceType.CreditNote
          ? 'Un avoir ne peut pas recevoir d’avoir : refacturez si besoin.'
          : `Seule une facture émise peut recevoir un avoir (statut ` +
              `actuel : ${source.status}). Un brouillon se corrige ` +
              'directement.',
      );
    }

    // Lignes fournies = avoir partiel ; absentes = copie intégrale de
    // la source (avoir total). Les lignes copiées gardent les prix
    // FIGÉS de la facture — pas ceux du catalogue d'aujourd'hui.
    const lines: InvoiceLineInput[] =
      input.lines ??
      source.lines.map((line) => ({
        productId: line.productId ?? undefined,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate,
      }));

    return this.createInvoiceUseCase.execute(actor, {
      customerId: source.customerId,
      notes: input.notes ?? `Avoir sur la facture ${source.number}.`,
      lines,
      type: InvoiceType.CreditNote,
      creditNoteForId: source.id,
    });
  }
}
