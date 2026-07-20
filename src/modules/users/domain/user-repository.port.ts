import { UserRole } from '../../../common/enums/user-role.enum';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { User } from './user';

/** Critères de listing des utilisateurs. */
export interface ListUsersQuery {
  page: number;
  limit: number;
  /** Colonne logique de tri (validée contre la liste blanche du module). */
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur email et displayName. */
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

/** Données nécessaires à la création d'un utilisateur local. */
export interface CreateUserData {
  /** E-mail déjà normalisé par l'appelant (trim + minuscules). */
  email: string;
  displayName: string;
  /** Hash Argon2id déjà calculé — JAMAIS de mot de passe en clair ici. */
  passwordHash: string;
  role: UserRole;
}

/** Champs modifiables d'un utilisateur (tous optionnels). */
export interface UpdateUserData {
  displayName?: string;
  isActive?: boolean;
  role?: UserRole;
}

/**
 * Contrat de persistance des utilisateurs.
 * Défini dans le domaine, implémenté par l'infrastructure TypeORM.
 * Les recherches excluent les utilisateurs supprimés logiquement —
 * sauf la variante IncludingDeleted, qui sert justement à les retrouver.
 */
export interface UserRepositoryPort {
  /** Liste paginée et filtrée. */
  findAll(query: ListUsersQuery): Promise<PaginatedResult<User>>;

  /** Recherche par identifiant ; null si inconnu ou supprimé. */
  findById(id: string): Promise<User | null>;

  /**
   * Recherche par identifiant, Y COMPRIS les comptes supprimés
   * logiquement. Sert uniquement à la réactivation.
   */
  findByIdIncludingDeleted(id: string): Promise<User | null>;

  /** Recherche par e-mail (déjà normalisé) ; null si inconnu ou supprimé. */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Nombre d'administrateurs actifs (non supprimés, is_active = true).
   * Sert aux garde-fous « dernier ADMIN ».
   */
  countActiveAdmins(): Promise<number>;

  /** Crée un utilisateur local actif et le renvoie. */
  create(data: CreateUserData): Promise<User>;

  /** Applique les champs fournis et renvoie l'utilisateur à jour. */
  update(id: string, data: UpdateUserData): Promise<User>;

  /** Remplace le hash du mot de passe (hash DÉJÀ calculé par l'appelant). */
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;

  /** Suppression logique : pose deleted_at ET is_active = false. */
  softDelete(id: string): Promise<void>;

  /** Annule la suppression logique ET réactive le compte. */
  restore(id: string): Promise<void>;

  /** Met à jour la date de dernière connexion. */
  updateLastLoginAt(id: string, lastLoginAt: Date): Promise<void>;
}

/** Jeton d'injection du repository utilisateurs. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
