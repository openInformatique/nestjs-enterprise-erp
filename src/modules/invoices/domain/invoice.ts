import { roundMoney } from '../../../common/money/money';
import { InvoiceLine } from './invoice-line';
import { InvoiceStatus } from './invoice-status.enum';
import { InvoiceType } from './invoice-type.enum';

/**
 * Facture ou avoir — agrégat racine.
 *
 * paidAmount est mis à jour EXCLUSIVEMENT par le module 08 : ici il
 * vaut toujours 0. remainingAmount est CALCULÉ, jamais stocké — une
 * donnée dérivable stockée finit toujours par diverger de sa source.
 */
export class Invoice {
  constructor(
    public readonly id: string,
    /** FAC-2026-0001 (facture) ou AV-2026-0001 (avoir), unique. */
    public readonly number: string,
    public readonly type: InvoiceType,
    public readonly customerId: string,
    /** Nom du client, dénormalisé pour l'affichage (jointure lecture). */
    public readonly customerName: string,
    /** Commande d'origine si la facture vient d'une conversion. */
    public readonly orderId: string | null,
    public readonly status: InvoiceStatus,
    public readonly issueDate: Date,
    public readonly dueDate: Date,
    public readonly totalHT: number,
    public readonly totalVAT: number,
    public readonly totalTTC: number,
    /** Propriété exclusive du module 08 — toujours 0 pour l'instant. */
    public readonly paidAmount: number,
    /** Facture corrigée par cet avoir (CREDIT_NOTE uniquement). */
    public readonly creditNoteForId: string | null,
    /** URL du PDF stocké — branché au niveau min-, null pour l'instant. */
    public readonly pdfUrl: string | null,
    public readonly notes: string | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** Vide dans les listes ; complet dans le détail. */
    public readonly lines: InvoiceLine[],
  ) {}

  /** Reste à payer : TTC - déjà payé, au centime. */
  remainingAmount(): number {
    return roundMoney(this.totalTTC - this.paidAmount);
  }

  isDraft(): boolean {
    return this.status === InvoiceStatus.Draft;
  }

  /** Annulable : brouillon ou envoyée — payée (même en partie), NON. */
  isCancellable(): boolean {
    return (
      this.status === InvoiceStatus.Draft || this.status === InvoiceStatus.Sent
    );
  }

  /**
   * Peut recevoir un avoir : une FACTURE émise (envoyée, en retard ou
   * payée). Jamais un brouillon (qui se corrige directement), jamais
   * un avoir (on ne corrige pas une correction : on refacture).
   */
  isCreditable(): boolean {
    return (
      this.type === InvoiceType.Invoice &&
      (this.status === InvoiceStatus.Sent ||
        this.status === InvoiceStatus.Overdue ||
        this.status === InvoiceStatus.PartiallyPaid ||
        this.status === InvoiceStatus.Paid)
    );
  }
}
