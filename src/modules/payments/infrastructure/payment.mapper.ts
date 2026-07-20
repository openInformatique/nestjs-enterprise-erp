import { Injectable } from '@nestjs/common';
import { Payment } from '../domain/payment';
import { PaymentEntity } from './entities/payment.entity';

/** Conversion entité TypeORM -> modèle de domaine. */
@Injectable()
export class PaymentMapper {
  toDomain(entity: PaymentEntity): Payment {
    return new Payment(
      entity.id,
      entity.invoiceId,
      entity.amount,
      entity.method,
      entity.reference,
      entity.notes,
      entity.paidAt,
      entity.recordedBy,
      entity.createdAt,
    );
  }
}
