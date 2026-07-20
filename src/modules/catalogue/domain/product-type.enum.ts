/**
 * Nature d'un article du catalogue.
 *
 * PRODUCT : bien physique — aura des niveaux de stock (module 04) et
 *           génèrera des mouvements lors des livraisons (module 06).
 * SERVICE : prestation — facturable mais JAMAIS de stock.
 */
export enum ProductType {
  Product = 'PRODUCT',
  Service = 'SERVICE',
}
