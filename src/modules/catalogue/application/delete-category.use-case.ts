import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type { CategoryRepositoryPort } from '../domain/category-repository.port';

/**
 * Cas d'utilisation : supprimer (logiquement) une catégorie.
 *
 * Deux règles d'intégrité, vérifiées AVANT la suppression :
 *   - pas de sous-catégories rattachées (elles deviendraient orphelines) ;
 *   - pas de produits rattachés (leur category_id pointerait dans le
 *     vide fonctionnellement — et la clé étrangère SQL transformerait
 *     de toute façon l'oubli en erreur 500 incompréhensible).
 * Un message 409 clair vaut toujours mieux qu'une erreur SQL.
 */
@Injectable()
export class DeleteCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(categoryId: string): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new ResourceNotFoundException('La catégorie');
    }

    if (await this.categoryRepository.hasChildren(categoryId)) {
      throw new BusinessRuleViolationException(
        'Impossible de supprimer cette catégorie : elle possède des ' +
          'sous-catégories.',
      );
    }
    if (await this.categoryRepository.hasProducts(categoryId)) {
      throw new BusinessRuleViolationException(
        'Impossible de supprimer cette catégorie : des produits y sont ' +
          'rattachés.',
      );
    }

    await this.categoryRepository.softDelete(categoryId);
  }
}
