import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { ContactsModule } from '../contact/contacts.module';
import { CancelInvoiceUseCase } from './application/cancel-invoice.use-case';
import { CheckOverdueInvoicesTask } from './application/check-overdue-invoices.task';
import { CheckOverdueInvoicesUseCase } from './application/check-overdue-invoices.use-case';
import { CreateCreditNoteUseCase } from './application/create-credit-note.use-case';
import { CreateInvoiceUseCase } from './application/create-invoice.use-case';
import { DeleteInvoiceUseCase } from './application/delete-invoice.use-case';
import { ExportInvoicesUseCase } from './application/export-invoices.use-case';
import { GetInvoiceByIdUseCase } from './application/get-invoice-by-id.use-case';
import { ListInvoicesUseCase } from './application/list-invoices.use-case';
import { ResolveInvoiceLinesHelper } from './application/resolve-invoice-lines.helper';
import { SendInvoiceUseCase } from './application/send-invoice.use-case';
import { UpdateInvoiceUseCase } from './application/update-invoice.use-case';
import { INVOICE_REPOSITORY } from './domain/invoice-repository.port';
import { InvoiceEntity } from './infrastructure/entities/invoice.entity';
import { InvoiceLineEntity } from './infrastructure/entities/invoice-line.entity';
import { InvoiceMapper } from './infrastructure/invoice.mapper';
import { TypeOrmInvoiceRepository } from './infrastructure/typeorm-invoice.repository';
import { InvoicesController } from './presentation/invoices.controller';

/**
 * Module de facturation (factures et avoirs).
 *
 * ⚠️ N'importe PAS OrdersModule (c'est OrdersModule qui importera
 * InvoicesModule pour la facturation de commande — l'inverse créerait
 * un cycle). La FK invoices.order_id passe par l'entité seule.
 *
 * Exports : INVOICE_REPOSITORY + CreateInvoiceUseCase (facturation de
 * commande, étape 11) + GetInvoiceByIdUseCase (module 08, paiements).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceEntity, InvoiceLineEntity]),
    ContactsModule,
    CatalogueModule,
    DatabaseModule,
    AuditModule,
  ],
  controllers: [InvoicesController],
  providers: [
    InvoiceMapper,
    ResolveInvoiceLinesHelper,
    ListInvoicesUseCase,
    GetInvoiceByIdUseCase,
    CreateInvoiceUseCase,
    UpdateInvoiceUseCase,
    DeleteInvoiceUseCase,
    SendInvoiceUseCase,
    CancelInvoiceUseCase,
    CreateCreditNoteUseCase,
    CheckOverdueInvoicesUseCase,
    CheckOverdueInvoicesTask,
    ExportInvoicesUseCase,
    {
      provide: INVOICE_REPOSITORY,
      useClass: TypeOrmInvoiceRepository,
    },
  ],
  exports: [INVOICE_REPOSITORY, CreateInvoiceUseCase, GetInvoiceByIdUseCase],
})
export class InvoicesModule {}
