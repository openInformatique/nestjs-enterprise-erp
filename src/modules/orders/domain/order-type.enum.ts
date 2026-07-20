/**
 * Sens d'une commande.
 *
 * CUSTOMER : un client nous commande — le stock SORT à la livraison.
 * SUPPLIER : nous commandons à un fournisseur — le stock ENTRE à la
 *            réception.
 */
export enum OrderType {
  Customer = 'CUSTOMER',
  Supplier = 'SUPPLIER',
}
