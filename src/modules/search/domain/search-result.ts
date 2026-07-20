/** Catégories cherchées par la recherche globale. */
export enum SearchResultType {
  Contact = 'CONTACT',
  Product = 'PRODUCT',
  Order = 'ORDER',
  Invoice = 'INVOICE',
}

/**
 * Un résultat de recherche, prêt pour un front (l'`url` cible une route
 * FRONT-END — `/contacts/:id` —, pas un endpoint de cette API).
 */
export interface SearchResult {
  type: SearchResultType;
  id: string;
  label: string;
  subtitle: string;
  url: string;
}
