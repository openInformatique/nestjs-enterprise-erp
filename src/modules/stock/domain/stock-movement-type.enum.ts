/**
 * Nature d'un mouvement de stock. La quantité d'un mouvement est
 * TOUJOURS positive : c'est le type qui porte la direction.
 */
export enum StockMovementType {
  /** Entrée : réception, achat (ou arrivée d'un transfert). */
  In = 'IN',
  /** Sortie : vente, consommation. */
  Out = 'OUT',
  /** Correction d'inventaire (écart constaté au comptage). */
  Adjustment = 'ADJUSTMENT',
  /** Départ d'un transfert inter-entrepôts (côté source). */
  Transfer = 'TRANSFER',
}
