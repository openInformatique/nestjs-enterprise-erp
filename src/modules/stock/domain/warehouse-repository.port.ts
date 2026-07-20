import { Warehouse } from './warehouse';

/** Filtres de listing (liste courte : pas de pagination). */
export interface ListWarehousesFilters {
  isActive?: boolean;
}

/** Données de création (code déjà normalisé par l'appelant). */
export interface CreateWarehouseData {
  name: string;
  code: string;
  street: string | null;
  city: string | null;
}

/** Champs modifiables d'un entrepôt. */
export interface UpdateWarehouseData {
  name?: string;
  code?: string;
  street?: string;
  city?: string;
  isActive?: boolean;
}

/** Contrat de persistance des entrepôts. */
export interface WarehouseRepositoryPort {
  findAll(filters: ListWarehousesFilters): Promise<Warehouse[]>;
  findById(id: string): Promise<Warehouse | null>;
  /** Recherche par code (déjà normalisé en MAJUSCULES). */
  findByCode(code: string): Promise<Warehouse | null>;
  create(data: CreateWarehouseData): Promise<Warehouse>;
  update(id: string, data: UpdateWarehouseData): Promise<Warehouse>;
  /** Désactivation (is_active = false) — jamais de suppression. */
  deactivate(id: string): Promise<void>;
}

/** Jeton d'injection du repository entrepôts. */
export const WAREHOUSE_REPOSITORY = Symbol('WAREHOUSE_REPOSITORY');
