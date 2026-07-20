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
import { OrderEntity } from '../../../orders/infrastructure/entities/order.entity';
import { InvoiceStatus } from '../../domain/invoice-status.enum';
import { InvoiceType } from '../../domain/invoice-type.enum';
import { InvoiceLineEntity } from './invoice-line.entity';

/**
 * Entité TypeORM de la table `invoices` (factures ET avoirs).
 *
 * credit_note_for_id : AUTO-RÉFÉRENCE — un avoir pointe vers la
 * facture qu'il corrige, dans la même table (même pattern que le
 * parent_id des catégories au module 03).
 */
@Entity({ name: 'invoices' })
export class InvoiceEntity extends AuditableEntity {
  /** FAC-2026-0001 ou AV-2026-0001, unique. */
  @Index('UQ_invoices_number', { unique: true })
  @Column({ name: 'number', type: 'nvarchar', length: 20 })
  number!: string;

  @Index('IX_invoices_type')
  @Column({ name: 'type', type: 'nvarchar', length: 12 })
  type!: InvoiceType;

  @Index('IX_invoices_customer')
  @Column({ name: 'customer_id', type: 'uniqueidentifier' })
  customerId!: string;

  @ManyToOne(() => ContactEntity)
  @JoinColumn({ name: 'customer_id' })
  customer?: ContactEntity;

  /** Commande d'origine si conversion (FK nullable vers orders). */
  @Column({ name: 'order_id', type: 'uniqueidentifier', nullable: true })
  orderId!: string | null;

  @ManyToOne(() => OrderEntity, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order?: OrderEntity | null;

  @Index('IX_invoices_status')
  @Column({ name: 'status', type: 'nvarchar', length: 15 })
  status!: InvoiceStatus;

  @Column({ name: 'issue_date', type: 'datetime2' })
  issueDate!: Date;

  /** Index : la tâche OVERDUE filtre sur cette colonne chaque nuit. */
  @Index('IX_invoices_due_date')
  @Column({ name: 'due_date', type: 'datetime2' })
  dueDate!: Date;

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

  /** Propriété exclusive du module 08 — reste à 0 dans ce module. */
  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new DecimalColumnTransformer(),
  })
  paidAmount!: number;

  /** AUTO-RÉFÉRENCE : la facture corrigée par cet avoir. */
  @Column({
    name: 'credit_note_for_id',
    type: 'uniqueidentifier',
    nullable: true,
  })
  creditNoteForId!: string | null;

  @ManyToOne(() => InvoiceEntity, { nullable: true })
  @JoinColumn({ name: 'credit_note_for_id' })
  creditNoteFor?: InvoiceEntity | null;

  /** URL du PDF stocké — branché au niveau min-, colonne déjà prête. */
  @Column({ name: 'pdf_url', type: 'nvarchar', length: 500, nullable: true })
  pdfUrl!: string | null;

  @Column({ name: 'notes', type: 'nvarchar', length: 2000, nullable: true })
  notes!: string | null;

  /** Les lignes vivent et meurent avec la facture. */
  @OneToMany(() => InvoiceLineEntity, (line) => line.invoice, {
    cascade: ['insert'],
  })
  lines?: InvoiceLineEntity[];
}
