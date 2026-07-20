import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { ProductEntity } from '../../../catalogue/infrastructure/entities/product.entity';
import { InvoiceEntity } from './invoice.entity';

/**
 * Entité TypeORM de la table `invoice_lines`.
 * onDelete: 'CASCADE' : la suppression d'un brouillon emporte ses lignes.
 */
@Entity({ name: 'invoice_lines' })
export class InvoiceLineEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Index('IX_invoice_lines_invoice')
  @Column({ name: 'invoice_id', type: 'uniqueidentifier' })
  invoiceId!: string;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: InvoiceEntity;

  /** null = ligne libre ; sinon trace du produit d'origine. */
  @Column({ name: 'product_id', type: 'uniqueidentifier', nullable: true })
  productId!: string | null;

  @ManyToOne(() => ProductEntity, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity | null;

  /** Ordre d'affichage des lignes (0, 1, 2...). */
  @Column({ name: 'position', type: 'int' })
  position!: number;

  @Column({ name: 'description', type: 'nvarchar', length: 500 })
  description!: string;

  @Column({
    name: 'quantity',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  quantity!: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  unitPrice!: number;

  @Column({
    name: 'vat_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 20,
    transformer: new DecimalColumnTransformer(),
  })
  vatRate!: number;

  @Column({
    name: 'subtotal_ht',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  subtotalHT!: number;
}
