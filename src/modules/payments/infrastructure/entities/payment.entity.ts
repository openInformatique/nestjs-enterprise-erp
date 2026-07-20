import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DecimalColumnTransformer } from '../../../../common/database/decimal-column.transformer';
import { ImmutableEntity } from '../../../../common/entities/immutable.entity';
import { InvoiceEntity } from '../../../invoices/infrastructure/entities/invoice.entity';
import { PaymentMethod } from '../../domain/payment-method.enum';

/**
 * Entité TypeORM de la table `payments` (journal immuable).
 *
 * ImmutableEntity : id + created_at, RIEN d'autre — pas d'updated_at
 * (un paiement ne se modifie pas), pas de deleted_at (une suppression
 * ADMIN est physique, le recalcul fait foi).
 *
 * Deux index : les paiements se cherchent par facture (recalcul de
 * paidAmount, détail d'une facture) et par période (date de valeur).
 */
@Entity({ name: 'payments' })
export class PaymentEntity extends ImmutableEntity {
  @Index('IX_payments_invoice')
  @Column({ name: 'invoice_id', type: 'uniqueidentifier' })
  invoiceId!: string;

  /** FK SQL : un paiement ne peut pas pointer une facture inexistante. */
  @ManyToOne(() => InvoiceEntity)
  @JoinColumn({ name: 'invoice_id' })
  invoice?: InvoiceEntity;

  /** Montant encaissé en EUR — de l'argent → decimal + transformer. */
  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalColumnTransformer(),
  })
  amount!: number;

  @Column({ name: 'method', type: 'nvarchar', length: 15 })
  method!: PaymentMethod;

  /** Référence externe (n° de virement, n° de chèque…). */
  @Column({ name: 'reference', type: 'nvarchar', length: 100, nullable: true })
  reference!: string | null;

  @Column({ name: 'notes', type: 'nvarchar', length: 500, nullable: true })
  notes!: string | null;

  /** Date de VALEUR de l'encaissement. */
  @Index('IX_payments_paid_at')
  @Column({ name: 'paid_at', type: 'datetime2' })
  paidAt!: Date;

  /**
   * UUID de l'utilisateur — simple colonne, PAS de relation vers users
   * (même choix que performedBy au module 04 : pas de couplage).
   */
  @Column({ name: 'recorded_by', type: 'uniqueidentifier' })
  recordedBy!: string;
}
