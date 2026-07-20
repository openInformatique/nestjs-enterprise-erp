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
import type { ProductRepositoryPort } from '../domain/product-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateProductInput {
  sku?: string;
  name: string;
  description?: string;
  type: ProductType;
  categoryId?: string;
  unitPrice: number;
  purchasePrice?: number;
  vatRate?: number;
  unit: ProductUnit;
}

/**
 * Cas d'utilisation : créer un produit ou un service.
 *
 * Règles :
 *   - SKU fourni : normalisé en MAJUSCULES, unicité vérifiée (409) ;
 *   - SKU absent : auto-généré (PROD-0001, PROD-0002...) à partir d'une
 *     séquence qui ne redescend jamais (count avec les supprimés) ;
 *   - la catégorie, si fournie, doit exister ;
 *   - TVA par défaut : 20 %.
 */
@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(input: CreateProductInput): Promise<Product> {
    if (input.categoryId !== undefined) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category) {
        throw new ResourceNotFoundException('La catégorie');
      }
    }

    const sku = await this.resolveSku(input.sku);

    return this.productRepository.create({
      sku,
      name: input.name.trim(),
      description: input.description ?? null,
      type: input.type,
      categoryId: input.categoryId ?? null,
      unitPrice: input.unitPrice,
      purchasePrice: input.purchasePrice ?? null,
      vatRate: input.vatRate ?? 20,
      unit: input.unit,
    });
  }

  /** SKU explicite (normalisé + unicité) ou auto-généré. */
  private async resolveSku(requested: string | undefined): Promise<string> {
    if (requested !== undefined) {
      const sku = requested.trim().toUpperCase();
      const existing = await this.productRepository.findBySku(sku);
      if (existing) {
        throw new ResourceAlreadyExistsException(
          'Un produit avec ce SKU existe déjà.',
        );
      }
      return sku;
    }

    // Auto-génération : PROD- + numéro sur 4 chiffres. La séquence est
    // dérivée du nombre total de produits (supprimés compris) : simple
    // et suffisant ici — deux créations rigoureusement simultanées
    // seraient départagées par l'index UNIQUE de la base.
    const sequence =
      (await this.productRepository.countAllIncludingDeleted()) + 1;
    return `PROD-${String(sequence).padStart(4, '0')}`;
  }
}
