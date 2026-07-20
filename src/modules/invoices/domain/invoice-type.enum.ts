/**
 * Nature du document.
 *
 * INVOICE     : facture — le client nous doit le montant.
 * CREDIT_NOTE : avoir — nous devons le montant au client. Ses montants
 *               sont stockés en POSITIF : c'est le type qui porte le
 *               sens (le module 08 fera la soustraction).
 */
export enum InvoiceType {
  Invoice = 'INVOICE',
  CreditNote = 'CREDIT_NOTE',
}
