import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { StockMovement } from './stock-movement';
import { StockMovementType } from './stock-movement-type.enum';

/** Critères de listing de l'historique des mouvements. */
export interface ListStockMovementsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur reference et notes. */
  search?: string;
  productId?: string;
  warehouseId?: string;
  type?: StockMovementType;
  /** Bornes sur performedAt (incluses). */
  from?: Date;
  to?: Date;
}

/**
 * Contrat de LECTURE des mouvements. La création passe par
 * StockWriterPort (un mouvement s'écrit toujours AVEC son niveau).
 */
export interface StockMovementRepositoryPort {
  findAll(
    query: ListStockMovementsQuery,
  ): Promise<PaginatedResult<StockMovement>>;
}

/** Jeton d'injection du repository des mouvements. */
export const STOCK_MOVEMENT_REPOSITORY = Symbol('STOCK_MOVEMENT_REPOSITORY');
