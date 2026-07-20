import { Injectable } from '@nestjs/common';
import { Category } from '../domain/category';
import { CategoryEntity } from './entities/category.entity';

/** Conversion entité TypeORM <-> modèle de domaine. */
@Injectable()
export class CategoryMapper {
  toDomain(entity: CategoryEntity): Category {
    return new Category(
      entity.id,
      entity.name,
      entity.description,
      entity.parentId,
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
