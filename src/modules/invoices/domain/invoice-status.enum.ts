/**
 * Cycle de vie d'une facture. Transitions AUTORISÉES :
 *
 *   DRAFT ──send──▶ SENT ──(paiements, module 08)──▶ PARTIALLY_PAID / PAID
 *     │               │──(cron quotidien)──▶ OVERDUE
 *     └────cancel─────┘
 *
 * PARTIALLY_PAID et PAID existent dès maintenant mais ne sont posés
 * par RIEN dans ce module : ils appartiennent au module 08 (paidAmount
 * est sa propriété exclusive).
 *
 * RÈGLE D'OR : une facture SENT ne se modifie plus jamais. Payée même
 * partiellement, elle ne s'annule plus non plus — on crée un AVOIR.
 */
export enum InvoiceStatus {
  Draft = 'DRAFT',
  Sent = 'SENT',
  PartiallyPaid = 'PARTIALLY_PAID',
  Paid = 'PAID',
  Overdue = 'OVERDUE',
  Cancelled = 'CANCELLED',
}
