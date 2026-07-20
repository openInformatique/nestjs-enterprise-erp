import { Category } from './category';

/** Filtres de listing des catégories (liste courte : pas de pagination). */
export interface ListCategoriesFilters {
  isActive?: boolean;
}

/** Données de création d'une catégorie. */
export interface CreateCategoryData {
  name: string;
  description: string | null;
  parentId: string | null;
}

/** Champs modifiables d'une catégorie. */
export interface UpdateCategoryData {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}

/**
 * Contrat de persistance des catégories.
 * Les recherches excluent les catégories supprimées logiquement.
 */
export interface CategoryRepositoryPort {
  /** Liste plate (le front reconstitue l'arbre via parentId). */
  findAll(filters: ListCategoriesFilters): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  create(data: CreateCategoryData): Promise<Category>;
  update(id: string, data: UpdateCategoryData): Promise<Category>;
  softDelete(id: string): Promise<void>;
  /** True si au moins un produit (non supprimé) référence la catégorie. */
  hasProducts(id: string): Promise<boolean>;
  /** True si au moins une sous-catégorie (non supprimée) existe. */
  hasChildren(id: string): Promise<boolean>;
}

/** Jeton d'injection du repository catégories. */
export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
