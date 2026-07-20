import { ProductType } from './product-type.enum';
import { ProductUnit } from './product-unit.enum';

/**
 * Article du catalogue (bien physique ou prestation).
 *
 * Les prix sont des montants HT en EUR, portés par des colonnes SQL
 * decimal(12,2) — jamais de float (imprécisions binaires interdites
 * quand on parle d'argent).
 */
export class Product {
  constructor(
    public readonly id: string,
    /** Référence unique, normalisée en MAJUSCULES (ex. : PROD-0001). */
    public readonly sku: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly type: ProductType,
    public readonly categoryId: string | null,
    /** Prix de vente HT en EUR. */
    public readonly unitPrice: number,
    /** Prix d'achat HT en EUR (calcul de marge), si connu. */
    public readonly purchasePrice: number | null,
    /** Taux de TVA en % (0, 5.5, 10 ou 20). */
    public readonly vatRate: number,
    public readonly unit: ProductUnit,
    public readonly isActive: boolean,
    public readonly imageUrl: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  /**
   * Seuls les biens physiques ont un stock. Les modules 04 (stocks) et
   * 06 (commandes) s'appuieront sur cette méthode pour ignorer les
   * services dans les mouvements.
   */
  isStockManaged(): boolean {
    return this.type === ProductType.Product;
  }
}
