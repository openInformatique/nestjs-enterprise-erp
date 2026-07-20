import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { Category } from '../domain/category';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type {
  CategoryRepositoryPort,
  UpdateCategoryData,
} from '../domain/category-repository.port';

/** Champs modifiables (sémantique PATCH). */
export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  parentId?: string;
  isActive?: boolean;
}

/**
 * Cas d'utilisation : modifier une catégorie.
 * Mêmes règles de hiérarchie qu'à la création, plus une évidente mais
 * indispensable : une catégorie ne peut pas devenir sa propre parente.
 */
@Injectable()
export class UpdateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new ResourceNotFoundException('La catégorie');
    }

    if (input.parentId !== undefined) {
      // UUID SQL Server en majuscules vs saisie client : comparaison
      // insensible à la casse (cf. modules 01 et 02).
      if (input.parentId.toLowerCase() === categoryId.toLowerCase()) {
        throw new BusinessRuleViolationException(
          'Une catégorie ne peut pas être sa propre parente.',
        );
      }
      const parent = await this.categoryRepository.findById(input.parentId);
      if (!parent) {
        throw new ResourceNotFoundException('La catégorie parente');
      }
      if (!parent.isRoot()) {
        throw new BusinessRuleViolationException(
          'Un seul niveau de sous-catégories est autorisé : la catégorie ' +
            'parente est déjà une sous-catégorie.',
        );
      }
    }

    const changes: UpdateCategoryData = { ...input };
    if (input.name !== undefined) {
      changes.name = input.name.trim();
    }

    return this.categoryRepository.update(categoryId, changes);
  }
}
