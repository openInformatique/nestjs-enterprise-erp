import { OrderLine } from './order-line';
import { OrderStatus } from './order-status.enum';
import { OrderType } from './order-type.enum';

/**
 * Commande — agrégat racine, client OU fournisseur selon `type`.
 *
 * warehouseId mémorise l'entrepôt utilisé par la logistique : posé au
 * départ en livraison (CUSTOMER, pour savoir OÙ réinjecter en cas
 * d'annulation) ou à la réception (SUPPLIER).
 */
export class Order {
  constructor(
    public readonly id: string,
    /** CMD-2026-0001 (client) ou CDF-2026-0001 (fournisseur). */
    public readonly number: string,
    public readonly type: OrderType,
    public readonly contactId: string,
    /** Nom du contact, dénormalisé pour l'affichage (jointure lecture). */
    public readonly contactName: string,
    public readonly status: OrderStatus,
    /** Devis d'origine si la commande vient d'une conversion. */
    public readonly quoteId: string | null,
    /** Entrepôt de livraison/réception, posé par les transitions. */
    public readonly warehouseId: string | null,
    public readonly notes: string | null,
    public readonly totalHT: number,
    public readonly totalVAT: number,
    public readonly totalTTC: number,
    public readonly expectedDeliveryDate: Date | null,
    public readonly deliveredAt: Date | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** Vide dans les listes ; complet dans le détail. */
    public readonly lines: OrderLine[],
  ) {}

  isDraft(): boolean {
    return this.status === OrderStatus.Draft;
  }

  isConfirmed(): boolean {
    return this.status === OrderStatus.Confirmed;
  }

  isInProgress(): boolean {
    return this.status === OrderStatus.InProgress;
  }

  /** Modifiable tant que la logistique n'a pas commencé. */
  isEditable(): boolean {
    return this.isDraft() || this.isConfirmed();
  }

  /** Annulable depuis tout état sauf livrée ou déjà annulée. */
  isCancellable(): boolean {
    return (
      this.status !== OrderStatus.Delivered &&
      this.status !== OrderStatus.Cancelled
    );
  }
}
