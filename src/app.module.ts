import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { isTechnicalDemoEnabled } from './bootstrap-env';
import { ContextModule } from './common/context/context.module';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { LoggingModule } from './common/logging/logging.module';
import { ThrottlingModule } from './common/security/throttling.module';
import { ConfigurationModule } from './config/configuration.module';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { StorageModule } from './modules/storage/storage.module';
import { TechnicalDemoModule } from './modules/technical-demo/technical-demo.module';
import { UsersModule } from './modules/users/users.module';
import { ContactsModule } from './modules/contact/contacts.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { StockModule } from './modules/stock/stock.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SearchModule } from './modules/search/search.module';

/**
 * Module racine du monolithe modulaire.
 *
 * Chaque brique technique du socle est portée par un module dédié.
 * Le middleware de contexte de requête est appliqué à toutes les routes :
 * il fournit le request ID et le contexte AsyncLocalStorage à l'ensemble
 * de la chaîne de traitement (logs, audits, erreurs).
 */
@Module({
  imports: [
    ConfigurationModule,
    ContextModule,
    LoggingModule,
    ThrottlingModule,
    DatabaseModule,
    UsersModule,
    ContactsModule,
    CatalogueModule,
    StockModule,
    QuotesModule,
    OrdersModule,
    InvoicesModule,
    PaymentsModule,
    DashboardModule,
    SearchModule,
    AuthenticationModule,
    AuditModule,
    ObservabilityModule,
    HealthModule,
    MailModule,
    StorageModule,
    PdfModule,
    SchedulerModule,
    // Endpoints de démonstration : routes inexistantes lorsque désactivés.
    ...(isTechnicalDemoEnabled() ? [TechnicalDemoModule] : []),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
