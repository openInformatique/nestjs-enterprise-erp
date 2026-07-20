import { Inject, Injectable } from '@nestjs/common';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { CONTACT_REPOSITORY } from '../../contact/domain/contact-repository.port';
import type { ContactRepositoryPort } from '../../contact/domain/contact-repository.port';
import { PRODUCT_REPOSITORY } from '../../catalogue/domain/product-repository.port';
import type { ProductRepositoryPort } from '../../catalogue/domain/product-repository.port';
import { ORDER_REPOSITORY } from '../../orders/domain/order-repository.port';
import type { OrderRepositoryPort } from '../../orders/domain/order-repository.port';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { SearchResult, SearchResultType } from '../domain/search-result';

/** 5 résultats par type, 20 au total (4 types). */
const RESULTS_PER_TYPE = 5;

/**
 * Cas d'utilisation : recherche globale.
 *
 * RÉUTILISE les repositories existants (findAll avec `search`) plutôt
 * que du SQL dédié : chaque module sait DÉJÀ chercher par texte depuis
 * le module 02 — le dupliquer ici serait de la duplication, pas de la
 * réutilisation transversale. Les 4 recherches partent en parallèle,
 * chacune ignorée si son type n'est pas demandé (`types`).
 */
@Injectable()
export class GlobalSearchUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
  ) {}

  async execute(
    q: string,
    types?: SearchResultType[],
  ): Promise<SearchResult[]> {
    const wants = (type: SearchResultType): boolean =>
      types === undefined || types.includes(type);

    const [contacts, products, orders, invoices] = await Promise.all([
      wants(SearchResultType.Contact) ? this.searchContacts(q) : [],
      wants(SearchResultType.Product) ? this.searchProducts(q) : [],
      wants(SearchResultType.Order) ? this.searchOrders(q) : [],
      wants(SearchResultType.Invoice) ? this.searchInvoices(q) : [],
    ]);

    return [...contacts, ...products, ...orders, ...invoices];
  }

  private async searchContacts(q: string): Promise<SearchResult[]> {
    const result = await this.contactRepository.findAll({
      page: 1,
      limit: RESULTS_PER_TYPE,
      sortDirection: SortDirection.Asc,
      search: q,
    });
    return result.items.map((contact) => ({
      type: SearchResultType.Contact,
      id: contact.id,
      label: contact.companyName,
      subtitle: contact.type,
      url: `/contacts/${contact.id}`,
    }));
  }

  private async searchProducts(q: string): Promise<SearchResult[]> {
    const result = await this.productRepository.findAll({
      page: 1,
      limit: RESULTS_PER_TYPE,
      sortDirection: SortDirection.Asc,
      search: q,
    });
    return result.items.map((product) => ({
      type: SearchResultType.Product,
      id: product.id,
      label: product.name,
      subtitle: product.sku,
      url: `/products/${product.id}`,
    }));
  }

  private async searchOrders(q: string): Promise<SearchResult[]> {
    const result = await this.orderRepository.findAll({
      page: 1,
      limit: RESULTS_PER_TYPE,
      sortDirection: SortDirection.Desc,
      search: q,
    });
    return result.items.map((order) => ({
      type: SearchResultType.Order,
      id: order.id,
      label: order.number,
      subtitle: `${order.contactName} — ${order.status}`,
      url: `/orders/${order.id}`,
    }));
  }

  private async searchInvoices(q: string): Promise<SearchResult[]> {
    const result = await this.invoiceRepository.findAll({
      page: 1,
      limit: RESULTS_PER_TYPE,
      sortDirection: SortDirection.Desc,
      search: q,
    });
    return result.items.map((invoice) => ({
      type: SearchResultType.Invoice,
      id: invoice.id,
      label: invoice.number,
      subtitle: `${invoice.customerName} — ${invoice.status}`,
      url: `/invoices/${invoice.id}`,
    }));
  }
}
