import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { ImmutableEntity } from '../../../../common/entities/immutable.entity';
import { ProductEntity } from '../../../catalogue/infrastructure/entities/product.entity';
import { StockMovementType } from '../../domain/stock-movement-type.enum';
import { WarehouseEntity } from './warehouse.entity';

/**
 * Entité TypeORM de la table `stock_movements` (journal immuable).
 *
 * Quatre index : l'historique se filtre par produit, entrepôt, type et
 * période — chacun a son index.
 */
@Entity({ name: 'stock_movements' })
export class StockMovementEntity extends ImmutableEntity {
  @Index('IX_stock_movements_product')
  @Column({ name: 'product_id', type: 'uniqueidentifier' })
  productId!: string;

  @Index('IX_stock_movements_warehouse')
  @Column({ name: 'warehouse_id', type: 'uniqueidentifier' })
  warehouseId!: string;

  /** Renseigné uniquement pour un TRANSFER (entrepôt de destination). */
  @Column({
    name: 'target_warehouse_id',
    type: 'uniqueidentifier',
    nullable: true,
  })
  targetWarehouseId!: string | null;

  @Index('IX_stock_movements_type')
  @Column({ name: 'type', type: 'nvarchar', length: 12 })
  type!: StockMovementType;

  /** Toujours positive : la direction est portée par le type. */
  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  /** Coût unitaire HT en EUR : de l'argent → decimal + transformer. */
  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: new DecimalColumnTransformer(),
  })
  unitCost!: number | null;

  @Column({ name: 'reference', type: 'nvarchar', length: 50, nullable: true })
  reference!: string | null;

  @Column({ name: 'notes', type: 'nvarchar', length: 500, nullable: true })
  notes!: string | null;

  /**
   * UUID de l'utilisateur — simple colonne, PAS de relation vers users
   * (même choix qu'AuditableEntity.createdBy : pas de couplage).
   */
  @Column({ name: 'performed_by', type: 'uniqueidentifier' })
  performedBy!: string;

  @Index('IX_stock_movements_performed_at')
  @Column({ name: 'performed_at', type: 'datetime2' })
  performedAt!: Date;

  /** Relations : clés étrangères SQL (le code n'utilise que les ids). */
  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity;

  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: WarehouseEntity;

  @ManyToOne(() => WarehouseEntity, { nullable: true })
  @JoinColumn({ name: 'target_warehouse_id' })
  targetWarehouse?: WarehouseEntity | null;
}
