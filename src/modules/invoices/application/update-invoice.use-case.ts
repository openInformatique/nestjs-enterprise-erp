import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import { GetContactByIdUseCase } from '../../contact/application/get-contact-by-id.use-case';
import { Invoice } from '../domain/invoice';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type {
  InvoiceRepositoryPort,
  UpdateInvoiceData,
} from '../domain/invoice-repository.port';
import { computeInvoiceTotals } from '../domain/invoice-totals';
import { GetInvoiceByIdUseCase } from './get-invoice-by-id.use-case';
import {
  InvoiceLineInput,
  ResolveInvoiceLinesHelper,
} from './resolve-invoice-lines.helper';

/** Champs modifiables (sémantique PATCH ; lines = remplacement complet). */
export interface UpdateInvoiceInput {
  customerId?: string;
  dueDate?: string;
  notes?: string;
  lines?: InvoiceLineInput[];
}

/**
 * Cas d'utilisation : modifier une facture — BROUILLON UNIQUEMENT.
 * Envoyée, une facture ne se corrige plus que par un avoir.
 */
@Injectable()
export class UpdateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly resolveInvoiceLinesHelper: ResolveInvoiceLinesHelper,
  ) {}

  async execute(
    invoiceId: string,
    input: UpdateInvoiceInput,
  ): Promise<Invoice> {
    const invoice = await this.getInvoiceByIdUseCase.execute(invoiceId);
    if (!invoice.isDraft()) {
      throw new BusinessRuleViolationException(
        `Seule une facture en brouillon est modifiable (statut actuel : ` +
          `${invoice.status}). Une facture émise se corrige par un avoir.`,
      );
    }

    const changes: UpdateInvoiceData = {};

    if (input.customerId !== undefined) {
      const contact = await this.getContactByIdUseCase.execute(
        input.customerId,
      );
      if (!contact.isCustomer()) {
        throw new BusinessRuleViolationException(
          `Le contact « ${contact.companyName} » n'est pas un client.`,
        );
      }
      changes.customerId = input.customerId;
    }

    if (input.dueDate !== undefined) {
      const dueDate = new Date(input.dueDate);
      if (dueDate < invoice.issueDate) {
        throw new BusinessRuleViolationException(
          "L'échéance ne peut pas être antérieure à la date d'émission.",
        );
      }
      changes.dueDate = dueDate;
    }

    if (input.notes !== undefined) {
      changes.notes = input.notes;
    }

    if (input.lines !== undefined) {
      const lines = await this.resolveInvoiceLinesHelper.resolve(input.lines);
      const totals = computeInvoiceTotals(lines);
      changes.lines = lines;
      changes.totalHT = totals.totalHT;
      changes.totalVAT = totals.totalVAT;
      changes.totalTTC = totals.totalTTC;
    }

    return this.invoiceRepository.update(invoiceId, changes);
  }
}
