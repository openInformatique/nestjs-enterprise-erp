import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { ContactsModule } from '../contact/contacts.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { StockModule } from '../stock/stock.module';
import { CancelOrderUseCase } from './application/cancel-order.use-case';
import { CollectStockLinesHelper } from './application/collect-stock-lines.helper';
import { CompleteOrderUseCase } from './application/complete-order.use-case';
import { ConfirmOrderUseCase } from './application/confirm-order.use-case';
import { ConvertOrderToInvoiceUseCase } from './application/convert-order-to-invoice.use-case';
import { CreateOrderUseCase } from './application/create-order.use-case';
import { DeleteOrderUseCase } from './application/delete-order.use-case';
import { ExportOrdersUseCase } from './application/export-orders.use-case';
import { GetOrderByIdUseCase } from './application/get-order-by-id.use-case';
import { ListOrdersUseCase } from './application/list-orders.use-case';
import { ResolveOrderLinesHelper } from './application/resolve-order-lines.helper';
import { StartDeliveryUseCase } from './application/start-delivery.use-case';
import { UpdateOrderUseCase } from './application/update-order.use-case';
import { ORDER_REPOSITORY } from './domain/order-repository.port';
import { OrderEntity } from './infrastructure/entities/order.entity';
import { OrderLineEntity } from './infrastructure/entities/order-line.entity';
import { OrderMapper } from './infrastructure/order.mapper';
import { TypeOrmOrderRepository } from './infrastructure/typeorm-order.repository';
import { OrdersController } from './presentation/orders.controller';

/**
 * Module des commandes (clients et fournisseurs).
 *
 * Imports : Contacts (validation du contact), Catalogue (résolution
 * des lignes), Stock (writer atomique + niveaux + entrepôts pour la
 * logistique), Database (remplacement transactionnel des lignes).
 *
 * ⚠️ N'importe PAS QuotesModule (c'est QuotesModule qui importera
 * OrdersModule pour la conversion — l'inverse créerait un cycle).
 * La FK orders.quote_id passe par l'entité seule.
 *
 * Exports : ORDER_REPOSITORY + CreateOrderUseCase (conversion de devis,
 * étape 11) + GetOrderByIdUseCase (module 07, facturation).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderLineEntity]),
    ContactsModule,
    CatalogueModule,
    StockModule,
    DatabaseModule,
    // Facturation de commande. Sens UNIQUE : InvoicesModule n'importe
    // jamais OrdersModule (cycle interdit).
    InvoicesModule,
    AuditModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrderMapper,
    ResolveOrderLinesHelper,
    CollectStockLinesHelper,
    ListOrdersUseCase,
    GetOrderByIdUseCase,
    CreateOrderUseCase,
    UpdateOrderUseCase,
    DeleteOrderUseCase,
    ConfirmOrderUseCase,
    StartDeliveryUseCase,
    CompleteOrderUseCase,
    CancelOrderUseCase,
    ConvertOrderToInvoiceUseCase,
    ExportOrdersUseCase,
    {
      provide: ORDER_REPOSITORY,
      useClass: TypeOrmOrderRepository,
    },
  ],
  exports: [ORDER_REPOSITORY, CreateOrderUseCase, GetOrderByIdUseCase],
})
export class OrdersModule {}
