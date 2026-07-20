import { PaginationMetaDto } from './pagination-meta.dto';

/**
 * Résultat paginé retourné par les cas d'utilisation.
 *
 * L'interceptor d'enveloppe le détecte pour produire la réponse
 * standardisée : data = items, meta.pagination = meta.
 */
export interface PaginatedResult<TItem> {
  items: TItem[];
  meta: PaginationMetaDto;
}
