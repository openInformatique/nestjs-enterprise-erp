import { StockMovement } from './stock-movement';
import { StockMovementType } from './stock-movement-type.enum';

/** Données d'un mouvement à enregistrer. */
export interface NewStockMovementData {
  productId: string;
  warehouseId: string;
  targetWarehouseId: string | null;
  type: StockMovementType;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  notes: string | null;
  performedBy: string;
  performedAt: Date;
}

/**
 * Niveau RÉSULTANT à écrire : la quantité est la nouvelle valeur
 * absolue (déjà calculée par le use case), pas un delta.
 */
export interface StockLevelWrite {
  productId: string;
  warehouseId: string;
  quantity: number;
}

/**
 * Contrat d'écriture ATOMIQUE du stock : les mouvements et les niveaux
 * fournis sont persistés ensemble — tout réussit ou tout est annulé.
 * Renvoie les mouvements créés, dans l'ordre fourni.
 *
 * Le port ne mentionne NI TypeORM ni transaction : c'est un détail
 * d'infrastructure, le domaine dit seulement « atomique ».
 */
export interface StockWriterPort {
  write(
    movements: NewStockMovementData[],
    levels: StockLevelWrite[],
  ): Promise<StockMovement[]>;
}

/** Jeton d'injection de l'écrivain de stock. */
export const STOCK_WRITER = Symbol('STOCK_WRITER');
