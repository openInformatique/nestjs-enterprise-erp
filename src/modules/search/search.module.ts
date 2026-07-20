import { Module } from '@nestjs/common';
import { ContactsModule } from '../contact/contacts.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { OrdersModule } from '../orders/orders.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { GlobalSearchUseCase } from './application/global-search.use-case';
import { SearchController } from './presentation/search.controller';

/**
 * Module de recherche globale.
 *
 * Importe QUATRE modules métier (contacts, catalogue, commandes,
 * factures) : ce n'est PAS un défaut de conception — la recherche
 * réutilise volontairement leurs repositories déjà exportés plutôt que
 * de dupliquer leur logique de recherche textuelle. Aucun de ces
 * modules n'importe Search en retour : pas de cycle.
 *
 * Rien n'est exporté : personne ne consomme un résultat de recherche.
 */
@Module({
  imports: [ContactsModule, CatalogueModule, OrdersModule, InvoicesModule],
  controllers: [SearchController],
  providers: [GlobalSearchUseCase],
})
export class SearchModule {}
