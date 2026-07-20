import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Payment } from './payment';
import { PaymentMethod } from './payment-method.enum';

/** Critères de listing des paiements. */
export interface ListPaymentsQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  invoiceId?: string;
  method?: PaymentMethod;
  /** Bornes sur la date de VALEUR (paidAt), incluses. */
  from?: Date;
  to?: Date;
}

/** Données de création (déjà validées et résolues par le use case). */
export interface CreatePaymentData {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  recordedBy: string;
}

/** Contrat de persistance des paiements. */
export interface PaymentRepositoryPort {
  /** Liste paginée, filtrable ; tri par défaut : paidAt décroissant. */
  findAll(query: ListPaymentsQuery): Promise<PaginatedResult<Payment>>;

  /** Un paiement ; null si inconnu. */
  findById(id: string): Promise<Payment | null>;

  /** Tous les paiements d'une facture, par date de valeur croissante
   *  (l'histoire des encaissements se lit dans l'ordre). */
  findByInvoice(invoiceId: string): Promise<Payment[]>;

  /**
   * Somme des montants encaissés sur une facture, au centime.
   * LA source de vérité de paidAmount : recalculée à chaque écriture,
   * jamais incrémentée.
   */
  sumByInvoice(invoiceId: string): Promise<number>;

  /** Enregistre un paiement. */
  create(data: CreatePaymentData): Promise<Payment>;

  /** Suppression PHYSIQUE (journal corrigé par recalcul, pas par
   *  réécriture : le use case refait la somme juste après). */
  delete(id: string): Promise<void>;
}

/** Jeton d'injection du repository paiements. */
export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
