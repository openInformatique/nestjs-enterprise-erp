import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetContactByIdUseCase } from '../../contact/application/get-contact-by-id.use-case';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { InvoiceType } from '../domain/invoice-type.enum';
import { computeInvoiceTotals } from '../domain/invoice-totals';
import {
  InvoiceLineInput,
  ResolveInvoiceLinesHelper,
} from './resolve-invoice-lines.helper';

/** Délai de paiement par défaut (jours) — configurable au niveau min-. */
const DEFAULT_PAYMENT_TERM_DAYS = 30;

/** Données de création (déjà validées par le DTO). */
export interface CreateInvoiceInput {
  customerId: string;
  dueDate?: string;
  notes?: string;
  lines: InvoiceLineInput[];
  /** Champs internes — jamais exposés dans le DTO. */
  type?: InvoiceType;
  orderId?: string;
  creditNoteForId?: string;
}

/**
 * Cas d'utilisation : créer une facture (statut DRAFT).
 *
 * Sert AUSSI de brique interne : la conversion de commande (orderId)
 * et la création d'avoir (type + creditNoteForId) passent par lui —
 * ces champs internes n'existent pas dans le DTO public.
 */
@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveInvoiceLinesHelper: ResolveInvoiceLinesHelper,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateInvoiceInput,
  ): Promise<Invoice> {
    const contact = await this.getContactByIdUseCase.execute(input.customerId);
    if (!contact.isCustomer()) {
      throw new BusinessRuleViolationException(
        `Le contact « ${contact.companyName} » n'est pas un client : ` +
          'impossible de le facturer.',
      );
    }

    const lines = await this.resolveInvoiceLinesHelper.resolve(input.lines);
    const totals = computeInvoiceTotals(lines);

    const issueDate = new Date();
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : new Date(
          issueDate.getTime() + DEFAULT_PAYMENT_TERM_DAYS * 24 * 60 * 60 * 1000,
        );

    if (dueDate < issueDate) {
      throw new BusinessRuleViolationException(
        "L'échéance ne peut pas être antérieure à la date d'émission.",
      );
    }

    const type = input.type ?? InvoiceType.Invoice;

    return this.invoiceRepository.create({
      number: await this.invoiceRepository.nextNumber(type),
      type,
      customerId: input.customerId,
      orderId: input.orderId ?? null,
      status: InvoiceStatus.Draft,
      issueDate,
      dueDate,
      ...totals,
      paidAmount: 0,
      creditNoteForId: input.creditNoteForId ?? null,
      notes: input.notes ?? null,
      createdBy: actor.userId,
      lines,
    });
  }
}
