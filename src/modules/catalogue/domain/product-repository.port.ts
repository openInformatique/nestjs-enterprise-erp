import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Product } from './product';
import { ProductType } from './product-type.enum';
import { ProductUnit } from './product-unit.enum';

/** Critères de listing des produits. */
export interface ListProductsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur sku et name. */
  search?: string;
  categoryId?: string;
  type?: ProductType;
  isActive?: boolean;
}

/** Données de création (SKU déjà résolu — fourni ou auto-généré). */
export interface CreateProductData {
  sku: string;
  name: string;
  description: string | null;
  type: ProductType;
  categoryId: string | null;
  unitPrice: number;
  purchasePrice: number | null;
  vatRate: number;
  unit: ProductUnit;
}

/** Champs modifiables d'un produit. */
export interface UpdateProductData {
  sku?: string;
  name?: string;
  description?: string | null;
  type?: ProductType;
  categoryId?: string | null;
  unitPrice?: number;
  purchasePrice?: number | null;
  vatRate?: number;
  unit?: ProductUnit;
  isActive?: boolean;
}

/**
 * Contrat de persistance des produits.
 * Les recherches excluent les produits supprimés logiquement.
 */
export interface ProductRepositoryPort {
  findAll(query: ListProductsQuery): Promise<PaginatedResult<Product>>;
  findById(id: string): Promise<Product | null>;
  /** Recherche par SKU (déjà normalisé en majuscules par l'appelant). */
  findBySku(sku: string): Promise<Product | null>;
  /**
   * Nombre total de produits Y COMPRIS supprimés : sert à générer le
   * prochain SKU auto (la séquence ne doit jamais redescendre, sinon un
   * SKU déjà attribué pourrait être régénéré).
   */
  countAllIncludingDeleted(): Promise<number>;
  create(data: CreateProductData): Promise<Product>;
  update(id: string, data: UpdateProductData): Promise<Product>;
  softDelete(id: string): Promise<void>;
}

/** Jeton d'injection du repository produits. */
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
