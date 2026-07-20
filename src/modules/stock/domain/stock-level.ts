/**
 * Niveau de stock d'un produit dans un entrepôt.
 *
 * Identité = le COUPLE (productId, warehouseId) : il n'y a pas d'id
 * propre. Le niveau n'est jamais écrit directement par un utilisateur :
 * il est recalculé à chaque mouvement (les mouvements sont la source
 * de vérité, le niveau est un état dérivé maintenu en temps réel).
 */
export class StockLevel {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string,
    /** Jamais négatif (vérifié en use case ET par la base). */
    public readonly quantity: number,
    public readonly updatedAt: Date,
  ) {}
}

/**
 * Vue ENRICHIE d'un niveau de stock, pour l'affichage : les écrans de
 * stock ont besoin des noms, pas des UUID.
 *
 * C'est un « read model » : une simple forme de données produite par
 * une jointure SQL, sans comportement — à distinguer du modèle de
 * domaine StockLevel ci-dessus, utilisé pour les calculs.
 */
export interface StockLevelView {
  productId: string;
  productSku: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  updatedAt: Date;
}
