import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Order } from './order';
import { OrderStatus } from './order-status.enum';
import { OrderType } from './order-type.enum';
import { ComputedOrderLine } from './order-totals';

/** Critères de listing des commandes. */
export interface ListOrdersQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur le numéro et le nom du contact. */
  search?: string;
  type?: OrderType;
  status?: OrderStatus;
  contactId?: string;
  /** Bornes sur la date de création (incluses). */
  from?: Date;
  to?: Date;
}

/** Données de création (tout est déjà résolu et calculé). */
export interface CreateOrderData {
  number: string;
  type: OrderType;
  contactId: string;
  status: OrderStatus;
  quoteId: string | null;
  notes: string | null;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  expectedDeliveryDate: Date | null;
  createdBy: string;
  lines: ComputedOrderLine[];
}

/**
 * Champs modifiables. Les champs status / warehouseId / deliveredAt
 * sont pilotés EXCLUSIVEMENT par les use cases de transition — jamais
 * exposés à l'API de modification.
 */
export interface UpdateOrderData {
  contactId?: string;
  notes?: string | null;
  expectedDeliveryDate?: Date | null;
  totalHT?: number;
  totalVAT?: number;
  totalTTC?: number;
  /** Remplacement COMPLET des lignes si fourni. */
  lines?: ComputedOrderLine[];
  status?: OrderStatus;
  warehouseId?: string | null;
  deliveredAt?: Date | null;
}

/** Contrat de persistance des commandes. */
export interface OrderRepositoryPort {
  /** Liste paginée (contact joint, SANS les lignes). */
  findAll(query: ListOrdersQuery): Promise<PaginatedResult<Order>>;

  /** Détail complet (lignes triées + contact) ; null si inconnue. */
  findById(id: string): Promise<Order | null>;

  /** True si un devis a déjà été converti (anti double conversion). */
  existsForQuote(quoteId: string): Promise<boolean>;

  /** Prochain numéro de l'année (CMD- pour CUSTOMER, CDF- pour SUPPLIER). */
  nextNumber(type: OrderType): Promise<string>;

  /** Crée la commande ET ses lignes (atomique). */
  create(data: CreateOrderData): Promise<Order>;

  /** Modifie la commande, remplace les lignes si fournies (atomique). */
  update(id: string, data: UpdateOrderData): Promise<Order>;

  /** Suppression PHYSIQUE (brouillons uniquement, lignes en cascade). */
  delete(id: string): Promise<void>;
}

/** Jeton d'injection du repository commandes. */
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
