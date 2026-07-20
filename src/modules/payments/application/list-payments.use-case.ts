import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Payment } from '../domain/payment';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type {
  ListPaymentsQuery,
  PaymentRepositoryPort,
} from '../domain/payment-repository.port';

/** Cas d'utilisation : lister les paiements (pagination + filtres). */
@Injectable()
export class ListPaymentsUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
  ) {}

  execute(query: ListPaymentsQuery): Promise<PaginatedResult<Payment>> {
    return this.paymentRepository.findAll(query);
  }
}
