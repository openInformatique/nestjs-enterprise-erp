import { PaymentMethod } from './payment-method.enum';

/**
 * Paiement — un encaissement reçu sur une facture.
 *
 * IMMUABLE : un paiement ne se modifie jamais. Saisi par erreur, il se
 * SUPPRIME (ADMIN), et le statut de la facture est recalculé. C'est le
 * pattern du journal (stock_movements, audit_logs) : l'historique des
 * encaissements ne se réécrit pas.
 *
 * Le montant est TOUJOURS positif : un remboursement client n'est pas
 * un paiement négatif, c'est un avoir (module 07).
 */
export class Payment {
  constructor(
    public readonly id: string,
    public readonly invoiceId: string,
    /** Montant encaissé en EUR — strictement positif. */
    public readonly amount: number,
    public readonly method: PaymentMethod,
    /** Référence externe : n° de virement, n° de chèque… */
    public readonly reference: string | null,
    public readonly notes: string | null,
    /** Date de VALEUR de l'encaissement (fournie, ou « maintenant »). */
    public readonly paidAt: Date,
    /** UUID de l'utilisateur qui a saisi l'encaissement. */
    public readonly recordedBy: string,
    public readonly createdAt: Date,
  ) {}
}
