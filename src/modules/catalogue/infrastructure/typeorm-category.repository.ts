import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Category } from '../domain/category';
import {
  CategoryRepositoryPort,
  CreateCategoryData,
  ListCategoriesFilters,
  UpdateCategoryData,
} from '../domain/category-repository.port';
import { CategoryEntity } from './entities/category.entity';
import { ProductEntity } from './entities/product.entity';
import { CategoryMapper } from './category.mapper';

/**
 * Implémentation TypeORM du repository catégories.
 *
 * Volume faible (quelques dizaines de lignes) : l'API simple
 * repository.find() suffit — pas besoin du QueryBuilder ici.
 */
@Injectable()
export class TypeOrmCategoryRepository implements CategoryRepositoryPort {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repository: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    private readonly mapper: CategoryMapper,
  ) {}

  async findAll(filters: ListCategoriesFilters): Promise<Category[]> {
    const where: FindOptionsWhere<CategoryEntity> = {};
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const entities = await this.repository.find({
      where,
      order: { name: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findById(id: string): Promise<Category | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async create(data: CreateCategoryData): Promise<Category> {
    const entity = await this.repository.save(
      this.repository.create({ ...data, isActive: true }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    // undefined = « non fourni » : seuls les champs présents sont écrits.
    const changes: Partial<CategoryEntity> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (changes as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }

    const entity = await this.repository.findOne({ where: { id } });
    // L'appelant (use case) a vérifié l'existence avant de modifier.
    return this.mapper.toDomain(entity as CategoryEntity);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: false });
    await this.repository.softDelete({ id });
  }

  hasProducts(id: string): Promise<boolean> {
    // exists() exclut d'office les produits soft-deletés.
    return this.productRepository.exists({ where: { categoryId: id } });
  }

  hasChildren(id: string): Promise<boolean> {
    return this.repository.exists({ where: { parentId: id } });
  }
}
