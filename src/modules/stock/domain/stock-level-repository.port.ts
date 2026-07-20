import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { StockLevel, StockLevelView } from './stock-level';

/** Seuil en dessous duquel un stock est considéré « bas ». */
export const LOW_STOCK_THRESHOLD = 5;

/** Critères de listing des niveaux de stock. */
export interface ListStockLevelsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur SKU et nom du produit. */
  search?: string;
  productId?: string;
  warehouseId?: string;
  /** true = uniquement les stocks < LOW_STOCK_THRESHOLD. */
  lowStock?: boolean;
}

/**
 * Contrat de LECTURE des niveaux de stock.
 * Les écritures passent exclusivement par StockWriterPort (elles sont
 * indissociables d'un mouvement, dans la même transaction).
 */
export interface StockLevelRepositoryPort {
  /** Liste paginée et enrichie (jointures produit + entrepôt). */
  findAllViews(
    query: ListStockLevelsQuery,
  ): Promise<PaginatedResult<StockLevelView>>;

  /** Niveau d'un produit dans un entrepôt ; null si jamais mouvementé. */
  findOne(productId: string, warehouseId: string): Promise<StockLevel | null>;

  /** Somme des quantités d'un entrepôt (0 si aucun niveau). */
  sumQuantityForWarehouse(warehouseId: string): Promise<number>;
}

/** Jeton d'injection du repository des niveaux de stock. */
export const STOCK_LEVEL_REPOSITORY = Symbol('STOCK_LEVEL_REPOSITORY');
