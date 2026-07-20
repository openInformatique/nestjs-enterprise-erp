import { Inject, Injectable } from '@nestjs/common';
import { Category } from '../domain/category';
import { CATEGORY_REPOSITORY } from '../domain/category-repository.port';
import type {
  CategoryRepositoryPort,
  ListCategoriesFilters,
} from '../domain/category-repository.port';

/**
 * Cas d'utilisation : lister les catégories.
 * Retourne la liste PLATE (avec parentId) : c'est au consommateur
 * (front) de reconstituer l'arbre — plus simple et plus flexible
 * qu'un JSON imbriqué.
 */
@Injectable()
export class ListCategoriesUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  execute(filters: ListCategoriesFilters): Promise<Category[]> {
    return this.categoryRepository.findAll(filters);
  }
}
