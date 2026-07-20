import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Contact } from './contact';
import { ContactType } from './contact-type.enum';

/** Critères de listing des contacts. */
export interface ListContactsQuery {
  page: number;
  limit: number;
  /** Colonne logique de tri (validée contre la liste blanche du module). */
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur companyName, email et contactName. */
  search?: string;
  type?: ContactType;
  isActive?: boolean;
}

/**
 * Données de création d'un contact.
 * Les valeurs optionnelles sont déjà résolues par le use case :
 * ici, « absent » se dit `null` (et sera NULL en base).
 */
export interface CreateContactData {
  type: ContactType;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  siret: string | null;
  vatNumber: string | null;
  notes: string | null;
}

/** Champs modifiables d'un contact (tous optionnels). */
export interface UpdateContactData {
  type?: ContactType;
  companyName?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string;
  siret?: string | null;
  vatNumber?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

/**
 * Contrat de persistance des contacts.
 * Les recherches excluent les contacts supprimés logiquement.
 *
 * NOTE : la spec prévoit aussi hasActiveRelations(id) pour bloquer la
 * suppression d'un contact lié à des devis/commandes actifs. Elle sera
 * ajoutée quand ces modules existeront (à partir du module 05) — la
 * spec elle-même la décrit comme « implémentée après module 05 ».
 */
export interface ContactRepositoryPort {
  findAll(query: ListContactsQuery): Promise<PaginatedResult<Contact>>;
  findById(id: string): Promise<Contact | null>;
  create(data: CreateContactData): Promise<Contact>;
  update(id: string, data: UpdateContactData): Promise<Contact>;
  softDelete(id: string): Promise<void>;
}

/** Jeton d'injection du repository contacts. */
export const CONTACT_REPOSITORY = Symbol('CONTACT_REPOSITORY');
