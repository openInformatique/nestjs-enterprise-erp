import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Payment } from '../domain/payment';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';

/** Cas d'utilisation : récupérer un paiement (404 si inconnu). */
@Injectable()
export class GetPaymentByIdUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
  ) {}

  async execute(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new ResourceNotFoundException('Le paiement');
    }
    return payment;
  }
}
