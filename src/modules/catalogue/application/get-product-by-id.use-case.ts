import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Product } from '../domain/product';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type { ProductRepositoryPort } from '../domain/product-repository.port';

/**
 * Cas d'utilisation : récupérer un produit (404 si inconnu).
 * Sera réutilisé par les modules 04 (stocks), 05 (devis) et 06
 * (commandes) pour valider leurs lignes.
 */
@Injectable()
export class GetProductByIdUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(productId: string): Promise<Product> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ResourceNotFoundException('Le produit');
    }
    return product;
  }
}
