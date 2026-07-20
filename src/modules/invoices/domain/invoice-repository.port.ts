import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Invoice } from './invoice';
import { InvoiceStatus } from './invoice-status.enum';
import { InvoiceType } from './invoice-type.enum';
import { ComputedInvoiceLine } from './invoice-totals';

/** Critères de listing des factures. */
export interface ListInvoicesQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur le numéro et le nom du client. */
  search?: string;
  type?: InvoiceType;
  status?: InvoiceStatus;
  customerId?: string;
  /** Bornes sur la date d'ÉMISSION (incluses). */
  from?: Date;
  to?: Date;
}

/** Données de création (tout est déjà résolu et calculé). */
export interface CreateInvoiceData {
  number: string;
  type: InvoiceType;
  customerId: string;
  orderId: string | null;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  paidAmount: number;
  creditNoteForId: string | null;
  notes: string | null;
  createdBy: string;
  lines: ComputedInvoiceLine[];
}

/**
 * Champs modifiables (DRAFT uniquement, garanti par le use case).
 * status est piloté par les transitions ; paidAmount par le module 08
 * (paiements) — jamais par l'API de modification publique.
 */
export interface UpdateInvoiceData {
  customerId?: string;
  dueDate?: Date;
  notes?: string | null;
  totalHT?: number;
  totalVAT?: number;
  totalTTC?: number;
  /** Remplacement COMPLET des lignes si fourni. */
  lines?: ComputedInvoiceLine[];
  status?: InvoiceStatus;
  /** Posé EXCLUSIVEMENT par le module 08 : somme des paiements. */
  paidAmount?: number;
}

/** Contrat de persistance des factures. */
export interface InvoiceRepositoryPort {
  /** Liste paginée (client joint, SANS les lignes). */
  findAll(query: ListInvoicesQuery): Promise<PaginatedResult<Invoice>>;

  /** Détail complet (lignes triées + client) ; null si inconnue. */
  findById(id: string): Promise<Invoice | null>;

  /** Factures SENT / PARTIALLY_PAID à échéance dépassée (cron). */
  findOverdue(now: Date): Promise<Invoice[]>;

  /**
   * Factures impayées (OVERDUE + PARTIALLY_PAID), client joint, triées
   * par reste à payer décroissant — le résumé du module 08.
   */
  findUnpaid(query: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<Invoice>>;

  /** True si une commande a déjà été facturée (anti double facture). */
  existsForOrder(orderId: string): Promise<boolean>;

  /** Prochain numéro de l'année (FAC- ou AV- selon le type). */
  nextNumber(type: InvoiceType): Promise<string>;

  /** Crée la facture ET ses lignes (atomique). */
  create(data: CreateInvoiceData): Promise<Invoice>;

  /** Modifie la facture, remplace les lignes si fournies (atomique). */
  update(id: string, data: UpdateInvoiceData): Promise<Invoice>;

  /** Suppression PHYSIQUE (brouillons uniquement, lignes en cascade). */
  delete(id: string): Promise<void>;
}

/** Jeton d'injection du repository factures. */
export const INVOICE_REPOSITORY = Symbol('INVOICE_REPOSITORY');
