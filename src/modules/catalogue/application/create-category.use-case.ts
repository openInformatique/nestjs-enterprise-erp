import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../../common/exceptions/app-exceptions';
import { Category } from '../domain/category';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type { CategoryRepositoryPort } from '../domain/category-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateCategoryInput {
  name: string;
  description?: string;
  parentId?: string;
}

/**
 * Cas d'utilisation : créer une catégorie.
 *
 * Règles :
 *   - le parent, s'il est fourni, doit exister ;
 *   - le parent doit être une catégorie RACINE : un seul niveau de
 *     sous-catégories (choix de la spec, suffisant pour un catalogue
 *     de démonstration et beaucoup plus simple à afficher).
 */
@Injectable()
export class CreateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    if (input.parentId !== undefined) {
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

    return this.categoryRepository.create({
      name: input.name.trim(),
      description: input.description ?? null,
      parentId: input.parentId ?? null,
    });
  }
}
