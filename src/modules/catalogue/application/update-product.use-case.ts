import { Inject, Injectable } from '@nestjs/common';
import {
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type { CategoryRepositoryPort } from '../domain/category-repository.port';
import { Product } from '../domain/product';
import { ProductType } from '../domain/product-type.enum';
import { ProductUnit } from '../domain/product-unit.enum';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type {
  ProductRepositoryPort,
  UpdateProductData,
} from '../domain/product-repository.port';

/** Champs modifiables (sémantique PATCH). */
export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string;
  type?: ProductType;
  categoryId?: string;
  unitPrice?: number;
  purchasePrice?: number;
  vatRate?: number;
  unit?: ProductUnit;
  isActive?: boolean;
}

/**
 * Cas d'utilisation : modifier un produit.
 * Si le SKU change : re-vérification d'unicité (en ignorant le produit
 * lui-même). Si la catégorie change : elle doit exister.
 */
@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(
    productId: string,
    input: UpdateProductInput,
  ): Promise<Product> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ResourceNotFoundException('Le produit');
    }

    const changes: UpdateProductData = { ...input };

    if (input.sku !== undefined) {
      const sku = input.sku.trim().toUpperCase();
      const existing = await this.productRepository.findBySku(sku);
      if (existing && existing.id.toLowerCase() !== productId.toLowerCase()) {
        throw new ResourceAlreadyExistsException(
          'Un produit avec ce SKU existe déjà.',
        );
      }
      changes.sku = sku;
    }

    if (input.categoryId !== undefined) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category) {
        throw new ResourceNotFoundException('La catégorie');
      }
    }

    if (input.name !== undefined) {
      changes.name = input.name.trim();
    }

    return this.productRepository.update(productId, changes);
  }
}
