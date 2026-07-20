import { StockMovementType } from './stock-movement-type.enum';

/**
 * Mouvement de stock — la SOURCE DE VÉRITÉ du module.
 *
 * IMMUABLE : un mouvement ne se modifie ni ne se supprime jamais.
 * Une erreur se corrige par un mouvement inverse ou un ajustement,
 * exactement comme une écriture comptable. C'est ce qui rend
 * l'historique digne de confiance.
 */
export class StockMovement {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    /** Entrepôt concerné (source dans le cas d'un transfert). */
    public readonly warehouseId: string,
    /** Entrepôt de destination — uniquement pour un TRANSFER. */
    public readonly targetWarehouseId: string | null,
    public readonly type: StockMovementType,
    /** Toujours positive : la direction est portée par le type. */
    public readonly quantity: number,
    /** Coût unitaire HT en EUR (entrées sur achat), si connu. */
    public readonly unitCost: number | null,
    /** Référence externe libre (ex. : numéro de commande fournisseur). */
    public readonly reference: string | null,
    public readonly notes: string | null,
    /** UUID de l'utilisateur qui a enregistré le mouvement. */
    public readonly performedBy: string,
    public readonly performedAt: Date,
    public readonly createdAt: Date,
  ) {}
}
