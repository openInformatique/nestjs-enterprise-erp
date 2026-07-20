/**
 * Ligne de facture — figée à la création (modules 05/06 : un document
 * commercial copie ses données au moment T, il ne suit pas le catalogue).
 */
export class InvoiceLine {
  constructor(
    public readonly id: string,
    public readonly invoiceId: string,
    /** null = ligne libre (article hors catalogue). */
    public readonly productId: string | null,
    public readonly description: string,
    public readonly quantity: number,
    /** Prix unitaire HT en EUR, figé. */
    public readonly unitPrice: number,
    /** Taux de TVA en % (0, 5.5, 10, 20), figé. */
    public readonly vatRate: number,
    /** quantité × prix, arrondi au centime. */
    public readonly subtotalHT: number,
  ) {}
}
