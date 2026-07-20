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
import { QuoteEntity } from './quote.entity';

/**
 * Entité TypeORM de la table `quote_lines`.
 *
 * onDelete: 'CASCADE' : la suppression SQL d'un devis emporte ses
 * lignes — c'est la base qui garantit qu'aucune ligne orpheline ne
 * peut exister.
 */
@Entity({ name: 'quote_lines' })
export class QuoteLineEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Index('IX_quote_lines_quote')
  @Column({ name: 'quote_id', type: 'uniqueidentifier' })
  quoteId!: string;

  @ManyToOne(() => QuoteEntity, (quote) => quote.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quote_id' })
  quote?: QuoteEntity;

  /** null = ligne libre ; sinon trace du produit d'origine. */
  @Column({ name: 'product_id', type: 'uniqueidentifier', nullable: true })
  productId!: string | null;

  /** Relation déclarée pour la clé étrangère product_id -> products. */
  @ManyToOne(() => ProductEntity, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity | null;

  /** Ordre d'affichage des lignes sur le devis (0, 1, 2...). */
  @Column({ name: 'position', type: 'int' })
  position!: number;

  @Column({ name: 'description', type: 'nvarchar', length: 500 })
  description!: string;

  /** Quantité décimale (2.5 heures de main-d'œuvre). */
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
    name: 'discount_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: new DecimalColumnTransformer(),
  })
  discountPercent!: number;

  @Column({
    name: 'subtotal_ht',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  subtotalHT!: number;
}
