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
import { Product } from '../domain/product';
import {
  CreateProductData,
  ListProductsQuery,
  ProductRepositoryPort,
  UpdateProductData,
} from '../domain/product-repository.port';
import { ProductEntity } from './entities/product.entity';
import { ProductMapper } from './product.mapper';

/** Liste blanche de tri (anti-injection, cf. modules 01 et 02). */
const PRODUCT_SORTABLE_COLUMNS: ColumnWhitelist = {
  sku: 'product.sku',
  name: 'product.name',
  type: 'product.type',
  unitPrice: 'product.unitPrice',
  vatRate: 'product.vatRate',
  isActive: 'product.isActive',
  createdAt: 'product.createdAt',
};

/** Colonnes parcourues par la recherche textuelle. */
const PRODUCT_SEARCHABLE_COLUMNS = ['product.sku', 'product.name'] as const;

/**
 * Implémentation TypeORM du repository produits.
 * Les recherches standard excluent les lignes soft-deletées.
 */
@Injectable()
export class TypeOrmProductRepository implements ProductRepositoryPort {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repository: Repository<ProductEntity>,
    private readonly mapper: ProductMapper,
  ) {}

  async findAll(query: ListProductsQuery): Promise<PaginatedResult<Product>> {
    const queryBuilder = this.repository.createQueryBuilder('product');

    if (query.categoryId !== undefined) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.type !== undefined) {
      queryBuilder.andWhere('product.type = :type', { type: query.type });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('product.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      PRODUCT_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('product.name', SortDirection.Asc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        PRODUCT_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Product | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const entity = await this.repository.findOne({ where: { sku } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  countAllIncludingDeleted(): Promise<number> {
    // withDeleted : la séquence de SKU auto ne redescend jamais, même
    // après suppression de produits.
    return this.repository.count({ withDeleted: true });
  }

  async create(data: CreateProductData): Promise<Product> {
    const entity = await this.repository.save(
      this.repository.create({ ...data, isActive: true }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateProductData): Promise<Product> {
    const changes: Partial<ProductEntity> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (changes as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }

    const entity = await this.repository.findOne({ where: { id } });
    return this.mapper.toDomain(entity as ProductEntity);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: false });
    await this.repository.softDelete({ id });
  }
}
