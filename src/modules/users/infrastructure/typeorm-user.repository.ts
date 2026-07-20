import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { User } from '../domain/user';
import {
  CreateUserData,
  ListUsersQuery,
  UpdateUserData,
  UserRepositoryPort,
} from '../domain/user-repository.port';
import { AuthenticationSource } from '../domain/authentication-source.enum';
import { UserEntity } from './entities/user.entity';
import { UserMapper } from './user.mapper';

/**
 * Liste blanche de tri : nom logique exposé par l'API -> expression
 * TypeORM. SEULE source des colonnes utilisées dans ORDER BY : une
 * valeur hors liste est rejetée en 400 (anti-injection SQL).
 */
const USER_SORTABLE_COLUMNS: ColumnWhitelist = {
  email: 'user.email',
  displayName: 'user.displayName',
  role: 'user.role',
  isActive: 'user.isActive',
  createdAt: 'user.createdAt',
  lastLoginAt: 'user.lastLoginAt',
};

/** Colonnes parcourues par la recherche textuelle (paramètre search). */
const USER_SEARCHABLE_COLUMNS = ['user.email', 'user.displayName'] as const;

/**
 * Implémentation TypeORM du repository utilisateurs.
 * Les recherches standard excluent automatiquement les lignes
 * soft-deletées (comportement TypeORM avec @DeleteDateColumn).
 */
@Injectable()
export class TypeOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
    private readonly mapper: UserMapper,
  ) {}

  async findAll(query: ListUsersQuery): Promise<PaginatedResult<User>> {
    const queryBuilder = this.repository.createQueryBuilder('user');

    if (query.role !== undefined) {
      queryBuilder.andWhere('user.role = :role', { role: query.role });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      USER_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      // Tri par défaut : les plus récents d'abord.
      queryBuilder.orderBy('user.createdAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        USER_SORTABLE_COLUMNS,
      );
    }

    const result = await TypeOrmPaginationHelper.paginate(
      queryBuilder,
      query.page,
      query.limit,
    );

    return {
      items: result.items.map((entity) => this.mapper.toDomain(entity)),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByIdIncludingDeleted(id: string): Promise<User | null> {
    // withDeleted lève le filtre automatique sur deleted_at : c'est le
    // SEUL moyen de retrouver un compte désactivé pour le réactiver.
    const entity = await this.repository.findOne({
      where: { id },
      withDeleted: true,
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repository.findOne({ where: { email } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async countActiveAdmins(): Promise<number> {
    // count() ignore les lignes soft-deletées (comportement TypeORM) :
    // on ne compte donc que les admins réellement capables de se connecter.
    return this.repository.count({
      where: { role: UserRole.Admin, isActive: true },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    const entity = await this.repository.save(
      this.repository.create({
        email: data.email,
        displayName: data.displayName,
        passwordHash: data.passwordHash,
        authenticationSource: AuthenticationSource.Local,
        role: data.role,
        isActive: true,
      }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    // Seuls les champs réellement fournis sont écrits : un undefined ne
    // doit jamais écraser une valeur en base.
    const changes: Partial<UserEntity> = {};
    if (data.displayName !== undefined) {
      changes.displayName = data.displayName;
    }
    if (data.isActive !== undefined) {
      changes.isActive = data.isActive;
    }
    if (data.role !== undefined) {
      changes.role = data.role;
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }

    // Relecture : renvoie l'état réel en base (updated_at recalculé).
    const entity = await this.repository.findOne({ where: { id } });
    // L'appelant (use case) a vérifié l'existence avant de modifier.
    return this.mapper.toDomain(entity as UserEntity);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.repository.update({ id }, { passwordHash });
  }

  async softDelete(id: string): Promise<void> {
    // is_active = false AVANT le soft-delete : une ligne restaurée un
    // jour ne doit pas revenir active par surprise.
    await this.repository.update({ id }, { isActive: false });
    await this.repository.softDelete({ id });
  }

  async restore(id: string): Promise<void> {
    // restore() remet deleted_at à NULL ; on réactive ensuite le compte
    // (softDelete l'avait volontairement passé à is_active = false).
    await this.repository.restore({ id });
    await this.repository.update({ id }, { isActive: true });
  }

  async updateLastLoginAt(id: string, lastLoginAt: Date): Promise<void> {
    await this.repository.update({ id }, { lastLoginAt });
  }
}
