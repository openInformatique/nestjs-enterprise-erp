import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Product } from '../domain/product';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type {
  ListProductsQuery,
  ProductRepositoryPort,
} from '../domain/product-repository.port';

/** Cas d'utilisation : lister les produits (pagination + filtres). */
@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  execute(query: ListProductsQuery): Promise<PaginatedResult<Product>> {
    return this.productRepository.findAll(query);
  }
}
