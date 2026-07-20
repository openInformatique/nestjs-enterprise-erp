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
import { QuoteStatus } from '../../domain/quote-status.enum';
import { QuoteLineEntity } from './quote-line.entity';

/**
 * Entité TypeORM de la table `quotes`.
 *
 * cascade: ['insert'] sur lines : sauvegarder un devis avec ses lignes
 * les insère TOUTES dans la même opération (TypeORM ouvre lui-même une
 * transaction pour les save() en cascade).
 */
@Entity({ name: 'quotes' })
export class QuoteEntity extends AuditableEntity {
  /** Numéro unique, séquentiel par année (DEV-2026-0001). */
  @Index('UQ_quotes_number', { unique: true })
  @Column({ name: 'number', type: 'nvarchar', length: 20 })
  number!: string;

  @Index('IX_quotes_customer')
  @Column({ name: 'customer_id', type: 'uniqueidentifier' })
  customerId!: string;

  /** Relation : clé étrangère SQL + jointure du nom client en lecture. */
  @ManyToOne(() => ContactEntity)
  @JoinColumn({ name: 'customer_id' })
  customer?: ContactEntity;

  @Index('IX_quotes_status')
  @Column({ name: 'status', type: 'nvarchar', length: 10 })
  status!: QuoteStatus;

  @Column({ name: 'valid_until', type: 'datetime2' })
  validUntil!: Date;

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

  /** Les lignes vivent et meurent avec le devis. */
  @OneToMany(() => QuoteLineEntity, (line) => line.quote, {
    cascade: ['insert'],
  })
  lines?: QuoteLineEntity[];
}
