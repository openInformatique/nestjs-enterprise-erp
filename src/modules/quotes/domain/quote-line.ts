/**
 * Ligne de devis.
 *
 * PRINCIPE DU FIGEMENT : la ligne COPIE description, prix unitaire et
 * TVA au moment de sa création. Si le produit du catalogue change de
 * prix ensuite, le devis ne bouge pas — un devis est un engagement
 * daté, pas une vue dynamique du catalogue. productId ne sert plus
 * qu'à la traçabilité (null = ligne libre, hors catalogue).
 */
export class QuoteLine {
  constructor(
    public readonly id: string,
    public readonly quoteId: string,
    /** null = ligne libre (article hors catalogue). */
    public readonly productId: string | null,
    public readonly description: string,
    /** Quantité (décimales autorisées : 2.5 heures). */
    public readonly quantity: number,
    /** Prix unitaire HT en EUR, figé à la création. */
    public readonly unitPrice: number,
    /** Taux de TVA en % (0, 5.5, 10, 20), figé à la création. */
    public readonly vatRate: number,
    /** Remise en % (0–100). */
    public readonly discountPercent: number,
    /** quantité × prix × (1 - remise/100), arrondi au centime. */
    public readonly subtotalHT: number,
  ) {}
}
