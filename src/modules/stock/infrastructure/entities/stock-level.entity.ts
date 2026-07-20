import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductEntity } from '../../../catalogue/infrastructure/entities/product.entity';
import { WarehouseEntity } from './warehouse.entity';

/**
 * Entité TypeORM de la table `stock_levels`.
 *
 * Clé primaire COMPOSITE (product_id, warehouse_id) : deux
 * @PrimaryColumn. La contrainte CHECK interdit tout stock négatif AU
 * NIVEAU SQL : même si deux transactions concurrentes « croisent » la
 * vérification applicative, la base refuse la seconde écriture.
 */
@Entity({ name: 'stock_levels' })
@Check('CHK_stock_levels_quantity', '"quantity" >= 0')
export class StockLevelEntity {
  @PrimaryColumn({ name: 'product_id', type: 'uniqueidentifier' })
  productId!: string;

  @PrimaryColumn({ name: 'warehouse_id', type: 'uniqueidentifier' })
  warehouseId!: string;

  /** Index : les requêtes « low stock » filtrent sur cette colonne. */
  @Index('IX_stock_levels_quantity')
  @Column({ name: 'quantity', type: 'int', default: 0 })
  quantity!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
  updatedAt!: Date;

  /** Relations : clés étrangères SQL + jointures des vues enrichies. */
  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity;

  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: WarehouseEntity;
}
