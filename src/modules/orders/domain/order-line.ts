/**
 * Ligne de commande. Même principe de FIGEMENT qu'au module 05 : la
 * ligne copie description, prix et TVA au moment de sa création.
 * Pas de colonne remise : à la conversion d'un devis, la remise est
 * fondue dans le prix unitaire.
 */
export class OrderLine {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    /** null = ligne libre (article hors catalogue). */
    public readonly productId: string | null,
    public readonly description: string,
    public readonly quantity: number,
    /** Prix unitaire HT en EUR, figé à la création. */
    public readonly unitPrice: number,
    /** Taux de TVA en % (0, 5.5, 10, 20), figé à la création. */
    public readonly vatRate: number,
    /** quantité × prix, arrondi au centime. */
    public readonly subtotalHT: number,
  ) {}
}
