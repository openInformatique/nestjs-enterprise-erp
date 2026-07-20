import { ApiProperty } from '@nestjs/swagger';
import { Payment } from '../../domain/payment';
import { PaymentMethod } from '../../domain/payment-method.enum';

/** Représentation publique d'un paiement. */
export class PaymentResponseDto {
  @ApiProperty({ description: 'Identifiant du paiement (UUID).' })
  id!: string;

  @ApiProperty({ description: 'Facture encaissée.' })
  invoiceId!: string;

  @ApiProperty({ example: 500 })
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  method!: PaymentMethod;

  @ApiProperty({ nullable: true, example: 'VIR-2026-07-1842' })
  reference!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'Date de valeur.' })
  paidAt!: Date;

  @ApiProperty({ description: 'UUID du saisisseur.' })
  recordedBy!: string;

  @ApiProperty()
  createdAt!: Date;

  static fromDomain(payment: Payment): PaymentResponseDto {
    const dto = new PaymentResponseDto();
    dto.id = payment.id;
    dto.invoiceId = payment.invoiceId;
    dto.amount = payment.amount;
    dto.method = payment.method;
    dto.reference = payment.reference;
    dto.notes = payment.notes;
    dto.paidAt = payment.paidAt;
    dto.recordedBy = payment.recordedBy;
    dto.createdAt = payment.createdAt;
    return dto;
  }
}
