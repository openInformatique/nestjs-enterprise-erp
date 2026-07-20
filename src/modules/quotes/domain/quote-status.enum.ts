/**
 * Cycle de vie d'un devis. Transitions AUTORISÉES :
 *
 *   DRAFT ──send──▶ SENT ──accept──▶ ACCEPTED
 *                    │──reject──▶ REJECTED
 *                    └──(cron)──▶ EXPIRED
 *
 * Tout le reste est interdit : un devis accepté ne redevient jamais
 * brouillon, un brouillon ne peut pas être accepté sans avoir été
 * envoyé. Modification et suppression : DRAFT uniquement.
 */
export enum QuoteStatus {
  Draft = 'DRAFT',
  Sent = 'SENT',
  Accepted = 'ACCEPTED',
  Rejected = 'REJECTED',
  Expired = 'EXPIRED',
}
