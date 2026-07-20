import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../../domain/product';
import { ProductType } from '../../domain/product-type.enum';
import { ProductUnit } from '../../domain/product-unit.enum';

/**
 * Représentation publique d'un produit.
 * Version minimale : expose categoryId ; l'objet catégorie complet
 * embarqué (spec §8) arrive au niveau min- avec la jointure.
 */
export class ProductResponseDto {
  @ApiProperty({ description: 'Identifiant du produit (UUID).' })
  id!: string;

  @ApiProperty({ example: 'PROD-0001' })
  sku!: string;

  @ApiProperty({ example: 'Écran Dell 27" QHD' })
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ProductType })
  type!: ProductType;

  @ApiProperty({ nullable: true })
  categoryId!: string | null;

  @ApiProperty({ description: 'Prix de vente HT en EUR.', example: 349.9 })
  unitPrice!: number;

  @ApiProperty({ nullable: true, example: 220 })
  purchasePrice!: number | null;

  @ApiProperty({ example: 20 })
  vatRate!: number;

  @ApiProperty({ enum: ProductUnit })
  unit!: ProductUnit;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.sku = product.sku;
    dto.name = product.name;
    dto.description = product.description;
    dto.type = product.type;
    dto.categoryId = product.categoryId;
    dto.unitPrice = product.unitPrice;
    dto.purchasePrice = product.purchasePrice;
    dto.vatRate = product.vatRate;
    dto.unit = product.unit;
    dto.isActive = product.isActive;
    dto.imageUrl = product.imageUrl;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;
    return dto;
  }
}
