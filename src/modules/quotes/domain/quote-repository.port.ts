import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Quote } from './quote';
import { ComputedQuoteLine } from './quote-totals';
import { QuoteStatus } from './quote-status.enum';

/** Critères de listing des devis. */
export interface ListQuotesQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur le numéro et le nom du client. */
  search?: string;
  status?: QuoteStatus;
  customerId?: string;
  /** Bornes sur la date de création (incluses). */
  from?: Date;
  to?: Date;
}

/** Données de création (tout est déjà résolu et calculé). */
export interface CreateQuoteData {
  number: string;
  customerId: string;
  status: QuoteStatus;
  validUntil: Date;
  notes: string | null;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  createdBy: string;
  lines: ComputedQuoteLine[];
}

/**
 * Champs modifiables d'un devis (DRAFT uniquement, garanti par le use
 * case). Si `lines` est fourni : REMPLACEMENT COMPLET des lignes, avec
 * les totaux recalculés fournis ensemble.
 */
export interface UpdateQuoteData {
  customerId?: string;
  validUntil?: Date;
  notes?: string | null;
  totalHT?: number;
  totalVAT?: number;
  totalTTC?: number;
  lines?: ComputedQuoteLine[];
}

/** Contrat de persistance des devis. */
export interface QuoteRepositoryPort {
  /** Liste paginée (client joint, SANS les lignes). */
  findAll(query: ListQuotesQuery): Promise<PaginatedResult<Quote>>;

  /** Détail complet (lignes triées + client) ; null si inconnu. */
  findById(id: string): Promise<Quote | null>;

  /** Devis SENT dont validUntil est dépassée (pour la tâche cron). */
  findExpired(now: Date): Promise<Quote[]>;

  /** Prochain numéro de l'année courante (DEV-YYYY-NNNN). */
  nextNumber(): Promise<string>;

  /** Crée le devis ET ses lignes (atomique). */
  create(data: CreateQuoteData): Promise<Quote>;

  /** Modifie le devis, remplace les lignes si fournies (atomique). */
  update(id: string, data: UpdateQuoteData): Promise<Quote>;

  /** Change uniquement le statut (transitions et cron). */
  updateStatus(id: string, status: QuoteStatus): Promise<void>;

  /** Suppression PHYSIQUE (brouillons uniquement) ; les lignes suivent
   *  via ON DELETE CASCADE. */
  delete(id: string): Promise<void>;
}

/** Jeton d'injection du repository devis. */
export const QUOTE_REPOSITORY = Symbol('QUOTE_REPOSITORY');
