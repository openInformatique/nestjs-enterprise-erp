import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { ContactEntity } from '../../../contact/infrastructure/entities/contact.entity';
import { QuoteEntity } from '../../../quotes/infrastructure/entities/quote.entity';
import { WarehouseEntity } from '../../../stock/infrastructure/entities/warehouse.entity';
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';
import { OrderLineEntity } from './order-line.entity';

/**
 * Entité TypeORM de la table `orders`.
 * Même patron qu'au module 05 (quotes) : cascade d'insertion des
 * lignes, relations déclarées pour les clés étrangères SQL.
 */
@Entity({ name: 'orders' })
export class OrderEntity extends AuditableEntity {
  /** CMD-2026-0001 (client) ou CDF-2026-0001 (fournisseur), unique. */
  @Index('UQ_orders_number', { unique: true })
  @Column({ name: 'number', type: 'nvarchar', length: 20 })
  number!: string;

  @Index('IX_orders_type')
  @Column({ name: 'type', type: 'nvarchar', length: 10 })
  type!: OrderType;

  @Index('IX_orders_contact')
  @Column({ name: 'contact_id', type: 'uniqueidentifier' })
  contactId!: string;

  @ManyToOne(() => ContactEntity)
  @JoinColumn({ name: 'contact_id' })
  contact?: ContactEntity;

  @Index('IX_orders_status')
  @Column({ name: 'status', type: 'nvarchar', length: 12 })
  status!: OrderStatus;

  /** Devis d'origine si conversion (FK nullable vers quotes). */
  @Column({ name: 'quote_id', type: 'uniqueidentifier', nullable: true })
  quoteId!: string | null;

  @ManyToOne(() => QuoteEntity, { nullable: true })
  @JoinColumn({ name: 'quote_id' })
  quote?: QuoteEntity | null;

  /** Entrepôt de livraison/réception, posé par les transitions. */
  @Column({
    name: 'warehouse_id',
    type: 'uniqueidentifier',
    nullable: true,
  })
  warehouseId!: string | null;

  @ManyToOne(() => WarehouseEntity, { nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: WarehouseEntity | null;

  @Column({ name: 'notes', type: 'nvarchar', length: 2000, nullable: true })
  notes!: string | null;

  @Column({
    name: 'total_ht',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  totalHT!: number;

  @Column({
    name: 'total_vat',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  totalVAT!: number;

  @Column({
    name: 'total_ttc',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  totalTTC!: number;

  @Column({
    name: 'expected_delivery_date',
    type: 'datetime2',
    nullable: true,
  })
  expectedDeliveryDate!: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime2', nullable: true })
  deliveredAt!: Date | null;

  /** Les lignes vivent et meurent avec la commande. */
  @OneToMany(() => OrderLineEntity, (line) => line.order, {
    cascade: ['insert'],
  })
  lines?: OrderLineEntity[];
}
