/**
 * Nature d'un contact vis-à-vis de l'entreprise.
 *
 * BOTH couvre le cas réel d'un partenaire à la fois client et
 * fournisseur : il est alors utilisable dans les devis/commandes clients
 * ET dans les commandes fournisseurs (modules 05 et 06).
 */
export enum ContactType {
  Customer = 'CUSTOMER',
  Supplier = 'SUPPLIER',
  Both = 'BOTH',
}
