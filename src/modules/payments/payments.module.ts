import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { ContactsModule } from '../contact/contacts.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { DeletePaymentUseCase } from './application/delete-payment.use-case';
import { ExportPaymentsUseCase } from './application/export-payments.use-case';
import { GetOverdueSummaryUseCase } from './application/get-overdue-summary.use-case';
import { GetPaymentByIdUseCase } from './application/get-payment-by-id.use-case';
import { ListPaymentsUseCase } from './application/list-payments.use-case';
import { RecordPaymentUseCase } from './application/record-payment.use-case';
import { PAYMENT_REPOSITORY } from './domain/payment-repository.port';
import { PaymentEntity } from './infrastructure/entities/payment.entity';
import { PaymentMapper } from './infrastructure/payment.mapper';
import { TypeOrmPaymentRepository } from './infrastructure/typeorm-payment.repository';
import { PaymentsController } from './presentation/payments.controller';

/**
 * Module des paiements.
 *
 * Imports :
 *   - InvoicesModule : GetInvoiceByIdUseCase + INVOICE_REPOSITORY (le
 *     statut des factures est piloté d'ici — la promesse du 07) ;
 *   - ContactsModule : GetContactByIdUseCase (e-mail du client dans le
 *     résumé des impayés).
 *
 * PAYMENT_REPOSITORY est exporté : le module 09 (tableau de bord)
 * agrégera les encaissements.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
    InvoicesModule,
    ContactsModule,
    AuditModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentMapper,
    ListPaymentsUseCase,
    GetPaymentByIdUseCase,
    RecordPaymentUseCase,
    DeletePaymentUseCase,
    GetOverdueSummaryUseCase,
    ExportPaymentsUseCase,
    {
      provide: PAYMENT_REPOSITORY,
      useClass: TypeOrmPaymentRepository,
    },
  ],
  exports: [PAYMENT_REPOSITORY],
})
export class PaymentsModule {}
