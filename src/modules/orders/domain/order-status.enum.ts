/**
 * Cycle de vie d'une commande. Transitions AUTORISÉES :
 *
 *   DRAFT ─confirm─▶ CONFIRMED ─start─▶ IN_PROGRESS ─complete─▶ DELIVERED
 *     └───────────────────┴─────cancel──────┘
 *
 * CANCELLED est accessible depuis tout état SAUF DELIVERED (une
 * commande livrée ne s'annule plus : le module 07 gérera l'avoir).
 * Modification : DRAFT et CONFIRMED. Suppression : DRAFT.
 */
export enum OrderStatus {
  Draft = 'DRAFT',
  Confirmed = 'CONFIRMED',
  InProgress = 'IN_PROGRESS',
  Delivered = 'DELIVERED',
  Cancelled = 'CANCELLED',
}
