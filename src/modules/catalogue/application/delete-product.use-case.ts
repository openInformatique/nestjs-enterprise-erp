import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type { ProductRepositoryPort } from '../domain/product-repository.port';

/**
 * Cas d'utilisation : supprimer (logiquement) un produit.
 *
 * Version minimale : la vérification « pas de devis/commandes actifs
 * utilisant ce produit » (hasActiveUsages → 409) sera branchée quand
 * ces modules existeront (05/06). Le soft-delete rend l'erreur
 * réversible en attendant.
 */
@Injectable()
export class DeleteProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(productId: string): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ResourceNotFoundException('Le produit');
    }

    await this.productRepository.softDelete(productId);
  }
}
