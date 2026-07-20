import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationException } from '../../../common/exceptions/app-exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { GetInvoiceByIdUseCase } from '../../invoices/application/get-invoice-by-id.use-case';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { InvoiceStatus } from '../../invoices/domain/invoice-status.enum';
import { InvoiceType } from '../../invoices/domain/invoice-type.enum';
import { Payment } from '../domain/payment';
import { PaymentMethod } from '../domain/payment-method.enum';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';

/** Statuts de facture qui acceptent un encaissement. */
const PAYABLE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.Sent,
  InvoiceStatus.Overdue,
  InvoiceStatus.PartiallyPaid,
];

/** Données d'encaissement (déjà validées par le DTO). */
export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  /** Date de valeur ISO ; absente = maintenant. */
  paidAt?: string;
}

/**
 * Cas d'utilisation : enregistrer un encaissement.
 *
 * Règles :
 *   - la facture doit exister (404), être de type INVOICE (un avoir se
 *     déduit, ne s'encaisse pas) et être ÉMISE non soldée (SENT,
 *     OVERDUE ou PARTIALLY_PAID) ;
 *   - le montant ne peut pas dépasser le reste à payer (409, solde
 *     dans le message) ;
 *   - après création : paidAmount = SUM(payments) — RECALCULÉ, jamais
 *     incrémenté — puis statut PAID (soldée) ou PARTIALLY_PAID.
 *
 * L'e-mail de confirmation au client (passage en PAID) est branché au
 * niveau min- — le recalcul, lui, ne changera pas.
 */
@Injectable()
export class RecordPaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: RecordPaymentInput,
  ): Promise<Payment> {
    const invoice = await this.getInvoiceByIdUseCase.execute(input.invoiceId);

    if (invoice.type !== InvoiceType.Invoice) {
      throw new BusinessRuleViolationException(
        `${invoice.number} est un avoir : un avoir se déduit d'une ` +
          "facture, il ne s'encaisse pas.",
      );
    }
    if (!PAYABLE_STATUSES.includes(invoice.status)) {
      throw new BusinessRuleViolationException(
        `La facture ${invoice.number} (statut ${invoice.status}) ne peut ` +
          'pas recevoir de paiement : seules les factures SENT, OVERDUE ' +
          'ou PARTIALLY_PAID sont encaissables.',
      );
    }

    const remaining = invoice.remainingAmount();
    if (input.amount > remaining) {
      throw new BusinessRuleViolationException(
        `Le montant (${input.amount} €) dépasse le solde restant de la ` +
          `facture ${invoice.number} (${remaining} €).`,
      );
    }

    const payment = await this.paymentRepository.create({
      invoiceId: invoice.id,
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      recordedBy: actor.userId,
    });

    // SOURCE DE VÉRITÉ : la somme du journal, pas un incrément.
    const paidAmount = await this.paymentRepository.sumByInvoice(invoice.id);
    const status =
      paidAmount >= invoice.totalTTC
        ? InvoiceStatus.Paid
        : InvoiceStatus.PartiallyPaid;

    await this.invoiceRepository.update(invoice.id, { paidAmount, status });

    return payment;
  }
}
