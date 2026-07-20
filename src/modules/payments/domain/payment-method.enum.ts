/**
 * Moyen de paiement de l'encaissement.
 * OTHER couvre les cas réels non listés (compensation, crypto, bon
 * d'achat…) — la référence libre précise alors la nature.
 */
export enum PaymentMethod {
  BankTransfer = 'BANK_TRANSFER',
  Card = 'CARD',
  Cash = 'CASH',
  Check = 'CHECK',
  Other = 'OTHER',
}
