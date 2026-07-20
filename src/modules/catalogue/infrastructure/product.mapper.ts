import { Injectable } from '@nestjs/common';
import { Product } from '../domain/product';
import { ProductEntity } from './entities/product.entity';

/** Conversion entité TypeORM <-> modèle de domaine. */
@Injectable()
export class ProductMapper {
  toDomain(entity: ProductEntity): Product {
    return new Product(
      entity.id,
      entity.sku,
      entity.name,
      entity.description,
      entity.type,
      entity.categoryId,
      entity.unitPrice,
      entity.purchasePrice,
      entity.vatRate,
      entity.unit,
      entity.isActive,
      entity.imageUrl,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
