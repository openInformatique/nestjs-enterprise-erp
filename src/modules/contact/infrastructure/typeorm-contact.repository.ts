import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { Contact } from '../domain/contact';
import {
  ContactRepositoryPort,
  CreateContactData,
  ListContactsQuery,
  UpdateContactData,
} from '../domain/contact-repository.port';
import { ContactEntity } from './entities/contact.entity';
import { ContactMapper } from './contact.mapper';

/**
 * Liste blanche de tri : nom logique exposé par l'API -> expression
 * TypeORM. Une valeur hors liste est rejetée en 400 (anti-injection).
 */
const CONTACT_SORTABLE_COLUMNS: ColumnWhitelist = {
  companyName: 'contact.companyName',
  type: 'contact.type',
  city: 'contact.city',
  country: 'contact.country',
  isActive: 'contact.isActive',
  createdAt: 'contact.createdAt',
};

/** Colonnes parcourues par la recherche textuelle (paramètre search). */
const CONTACT_SEARCHABLE_COLUMNS = [
  'contact.companyName',
  'contact.email',
  'contact.contactName',
] as const;

/**
 * Implémentation TypeORM du repository contacts.
 * Les recherches standard excluent les lignes soft-deletées.
 */
@Injectable()
export class TypeOrmContactRepository implements ContactRepositoryPort {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly repository: Repository<ContactEntity>,
    private readonly mapper: ContactMapper,
  ) {}

  async findAll(query: ListContactsQuery): Promise<PaginatedResult<Contact>> {
    const queryBuilder = this.repository.createQueryBuilder('contact');

    if (query.type !== undefined) {
      queryBuilder.andWhere('contact.type = :type', { type: query.type });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('contact.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      CONTACT_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      // Tri par défaut de la spec : alphabétique sur le nom de société.
      queryBuilder.orderBy('contact.companyName', SortDirection.Asc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        CONTACT_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Contact | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async create(data: CreateContactData): Promise<Contact> {
    // Les clés de CreateContactData portent exactement les mêmes noms
    // que les propriétés de l'entité : la copie directe est sûre.
    const entity = await this.repository.save(
      this.repository.create({ ...data, isActive: true }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateContactData): Promise<Contact> {
    // undefined = « non fourni, ne pas toucher » ; null = « effacer ».
    // On ne copie donc QUE les clés réellement fournies.
    const changes: Partial<ContactEntity> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (changes as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }

    // Relecture : renvoie l'état réel en base (updated_at recalculé).
    const entity = await this.repository.findOne({ where: { id } });
    // L'appelant (use case) a vérifié l'existence avant de modifier.
    return this.mapper.toDomain(entity as ContactEntity);
  }

  async softDelete(id: string): Promise<void> {
    // is_active = false AVANT le soft-delete : une ligne restaurée un
    // jour ne doit pas revenir active par surprise.
    await this.repository.update({ id }, { isActive: false });
    await this.repository.softDelete({ id });
  }
}
