import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { ContactsModule } from '../contact/contacts.module';
import { OrdersModule } from '../orders/orders.module';
import { AcceptQuoteUseCase } from './application/accept-quote.use-case';
import { ConvertQuoteToOrderUseCase } from './application/convert-quote-to-order.use-case';
import { CreateQuoteUseCase } from './application/create-quote.use-case';
import { DeleteQuoteUseCase } from './application/delete-quote.use-case';
import { ExpireQuotesTask } from './application/expire-quotes.task';
import { ExpireQuotesUseCase } from './application/expire-quotes.use-case';
import { GetQuoteByIdUseCase } from './application/get-quote-by-id.use-case';
import { ListQuotesUseCase } from './application/list-quotes.use-case';
import { RejectQuoteUseCase } from './application/reject-quote.use-case';
import { ResolveQuoteLinesHelper } from './application/resolve-quote-lines.helper';
import { SendQuoteUseCase } from './application/send-quote.use-case';
import { UpdateQuoteUseCase } from './application/update-quote.use-case';
import { QUOTE_REPOSITORY } from './domain/quote-repository.port';
import { QuoteEntity } from './infrastructure/entities/quote.entity';
import { QuoteLineEntity } from './infrastructure/entities/quote-line.entity';
import { QuoteMapper } from './infrastructure/quote.mapper';
import { TypeOrmQuoteRepository } from './infrastructure/typeorm-quote.repository';
import { QuotesController } from './presentation/quotes.controller';

/**
 * Module des devis.
 *
 * Imports :
 *   - ContactsModule : GetContactByIdUseCase (validation du client) ;
 *   - CatalogueModule : GetProductByIdUseCase (résolution des lignes) ;
 *   - DatabaseModule : TransactionService (remplacement des lignes).
 *
 * QUOTE_REPOSITORY et GetQuoteByIdUseCase sont exportés : le module
 * commandes (06) en aura besoin pour convertir un devis accepté.
 *
 * La tâche cron ExpireQuotesTask vit ici (le @Cron fonctionne car
 * ScheduleModule.forRoot() est déjà enregistré par SchedulerModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([QuoteEntity, QuoteLineEntity]),
    ContactsModule,
    CatalogueModule,
    DatabaseModule,
    // Conversion devis -> commande. Sens UNIQUE : OrdersModule
    // n'importe jamais QuotesModule (cycle interdit).
    OrdersModule,
  ],
  controllers: [QuotesController],
  providers: [
    QuoteMapper,
    ResolveQuoteLinesHelper,
    ListQuotesUseCase,
    GetQuoteByIdUseCase,
    CreateQuoteUseCase,
    UpdateQuoteUseCase,
    DeleteQuoteUseCase,
    SendQuoteUseCase,
    AcceptQuoteUseCase,
    RejectQuoteUseCase,
    ConvertQuoteToOrderUseCase,
    ExpireQuotesUseCase,
    ExpireQuotesTask,
    {
      provide: QUOTE_REPOSITORY,
      useClass: TypeOrmQuoteRepository,
    },
  ],
  exports: [QUOTE_REPOSITORY, GetQuoteByIdUseCase],
})
export class QuotesModule {}
