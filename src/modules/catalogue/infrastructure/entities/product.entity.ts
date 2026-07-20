import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { ProductType } from '../../domain/product-type.enum';
import { ProductUnit } from '../../domain/product-unit.enum';
import { CategoryEntity } from './category.entity';

/**
 * Entité TypeORM de la table `products`.
 *
 * Prix en decimal(12,2) avec transformer (voir
 * common/database/decimal-column.transformer.ts) : JAMAIS de float
 * pour de l'argent.
 */
@Entity({ name: 'products' })
export class ProductEntity extends AuditableEntity {
  /** Référence unique, normalisée en MAJUSCULES par la couche application. */
  @Index('UQ_products_sku', { unique: true })
  @Column({ name: 'sku', type: 'nvarchar', length: 30 })
  sku!: string;

  @Index('IX_products_name')
  @Column({ name: 'name', type: 'nvarchar', length: 255 })
  name!: string;

  @Column({
    name: 'description',
    type: 'nvarchar',
    length: 'max',
    nullable: true,
  })
  description!: string | null;

  @Index('IX_products_type')
  @Column({ name: 'type', type: 'nvarchar', length: 10 })
  type!: ProductType;

  /** FK exposée directement (même pattern que CategoryEntity.parentId). */
  @Column({ name: 'category_id', type: 'uniqueidentifier', nullable: true })
  categoryId!: string | null;

  /** Relation déclarée pour la clé étrangère category_id -> categories. */
  @ManyToOne(() => CategoryEntity, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: CategoryEntity | null;

  /** Prix de vente HT en EUR. */
  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  unitPrice!: number;

  /** Prix d'achat HT en EUR (marge), si connu. */
  @Column({
    name: 'purchase_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: new DecimalColumnTransformer(),
  })
  purchasePrice!: number | null;

  /** Taux de TVA en % (0, 5.5, 10, 20 — validé par le DTO). */
  @Column({
    name: 'vat_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 20,
    transformer: new DecimalColumnTransformer(),
  })
  vatRate!: number;

  @Column({ name: 'unit', type: 'nvarchar', length: 10 })
  unit!: ProductUnit;

  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;

  /** URL de l'image produit (upload branché au niveau min-). */
  @Column({ name: 'image_url', type: 'nvarchar', length: 500, nullable: true })
  imageUrl!: string | null;
}
