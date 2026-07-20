import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CreateCategoryUseCase } from './application/create-category.use-case';
import { CreateProductUseCase } from './application/create-product.use-case';
import { DeleteCategoryUseCase } from './application/delete-category.use-case';
import { DeleteProductUseCase } from './application/delete-product.use-case';
import { ExportProductsUseCase } from './application/export-products.use-case';
import { GetCategoryByIdUseCase } from './application/get-category-by-id.use-case';
import { GetProductByIdUseCase } from './application/get-product-by-id.use-case';
import { ListCategoriesUseCase } from './application/list-categories.use-case';
import { ListProductsUseCase } from './application/list-products.use-case';
import { UpdateCategoryUseCase } from './application/update-category.use-case';
import { UpdateProductUseCase } from './application/update-product.use-case';
import { CATEGORY_REPOSITORY } from './domain/category-repository.port';
import { PRODUCT_REPOSITORY } from './domain/product-repository.port';
import { CategoryMapper } from './infrastructure/category.mapper';
import { CategoryEntity } from './infrastructure/entities/category.entity';
import { ProductEntity } from './infrastructure/entities/product.entity';
import { ProductMapper } from './infrastructure/product.mapper';
import { TypeOrmCategoryRepository } from './infrastructure/typeorm-category.repository';
import { TypeOrmProductRepository } from './infrastructure/typeorm-product.repository';
import { CategoriesController } from './presentation/categories.controller';
import { ProductsController } from './presentation/products.controller';

/**
 * Module du catalogue (catégories + produits/services).
 *
 * PRODUCT_REPOSITORY et GetProductByIdUseCase sont exportés : les
 * modules stocks (04), devis (05) et commandes (06) en auront besoin
 * pour valider leurs lignes de produits.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CategoryEntity, ProductEntity]),
    AuditModule,
  ],
  controllers: [CategoriesController, ProductsController],
  providers: [
    CategoryMapper,
    ProductMapper,
    ListCategoriesUseCase,
    GetCategoryByIdUseCase,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
    ListProductsUseCase,
    GetProductByIdUseCase,
    CreateProductUseCase,
    UpdateProductUseCase,
    DeleteProductUseCase,
    ExportProductsUseCase,
    {
      provide: CATEGORY_REPOSITORY,
      useClass: TypeOrmCategoryRepository,
    },
    {
      provide: PRODUCT_REPOSITORY,
      useClass: TypeOrmProductRepository,
    },
  ],
  exports: [PRODUCT_REPOSITORY, GetProductByIdUseCase],
})
export class CatalogueModule {}
