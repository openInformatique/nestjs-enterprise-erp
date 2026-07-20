import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { TransactionService } from '../../../database/transaction/transaction.service';
import { Order } from '../domain/order';
import {
  CreateOrderData,
  ListOrdersQuery,
  OrderRepositoryPort,
  UpdateOrderData,
} from '../domain/order-repository.port';
import { OrderType } from '../domain/order-type.enum';
import { OrderEntity } from './entities/order.entity';
import { OrderLineEntity } from './entities/order-line.entity';
import { OrderMapper } from './order.mapper';

/** Liste blanche de tri (colonnes de la commande + contact joint). */
const ORDER_SORTABLE_COLUMNS: ColumnWhitelist = {
  number: 'order.number',
  type: 'order.type',
  status: 'order.status',
  totalTTC: 'order.totalTTC',
  expectedDeliveryDate: 'order.expectedDeliveryDate',
  contactName: 'contact.companyName',
  createdAt: 'order.createdAt',
};

/** Recherche textuelle : numéro et nom du contact. */
const ORDER_SEARCHABLE_COLUMNS = [
  'order.number',
  'contact.companyName',
] as const;

/** Implémentation TypeORM du repository commandes. */
@Injectable()
export class TypeOrmOrderRepository implements OrderRepositoryPort {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repository: Repository<OrderEntity>,
    private readonly transactionService: TransactionService,
    private readonly mapper: OrderMapper,
  ) {}

  async findAll(query: ListOrdersQuery): Promise<PaginatedResult<Order>> {
    const queryBuilder = this.repository
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.contact', 'contact');

    if (query.type !== undefined) {
      queryBuilder.andWhere('order.type = :type', { type: query.type });
    }
    if (query.status !== undefined) {
      queryBuilder.andWhere('order.status = :status', {
        status: query.status,
      });
    }
    if (query.contactId !== undefined) {
      queryBuilder.andWhere('order.contactId = :contactId', {
        contactId: query.contactId,
      });
    }
    if (query.from !== undefined) {
      queryBuilder.andWhere('order.createdAt >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('order.createdAt <= :to', { to: query.to });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      ORDER_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('order.createdAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        ORDER_SORTABLE_COLUMNS,
      );
    }

    const result = await TypeOrmPaginationHelper.paginate(
      queryBuilder,
      query.page,
      query.limit,
    );

    return {
      items: result.items.map((entity) => this.mapper.toDomain(entity)),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<Order | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { contact: true, lines: true },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  existsForQuote(quoteId: string): Promise<boolean> {
    return this.repository.exists({ where: { quoteId } });
  }

  async nextNumber(type: OrderType): Promise<string> {
    const year = new Date().getFullYear();
    // Deux séquences indépendantes : CMD- (clients) et CDF- (fournisseurs).
    const prefix = `${type === OrderType.Customer ? 'CMD' : 'CDF'}-${year}-`;

    const raw = await this.repository
      .createQueryBuilder('order')
      .select('MAX(order.number)', 'max')
      .where('order.number LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    const lastSequence = raw?.max ? Number(raw.max.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
  }

  async create(data: CreateOrderData): Promise<Order> {
    const { lines, ...orderColumns } = data;

    const entity = this.repository.create({
      ...orderColumns,
      lines: lines.map((line, index) => ({ ...line, position: index })),
    });
    const saved = await this.repository.save(entity);

    return (await this.findById(saved.id)) as Order;
  }

  async update(id: string, data: UpdateOrderData): Promise<Order> {
    const { lines, ...orderColumns } = data;

    await this.transactionService.execute(async (manager) => {
      const changes: Partial<OrderEntity> = {};
      for (const [key, value] of Object.entries(orderColumns)) {
        if (value !== undefined) {
          (changes as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(changes).length > 0) {
        await manager.getRepository(OrderEntity).update({ id }, changes);
      }

      if (lines !== undefined) {
        const lineRepository = manager.getRepository(OrderLineEntity);
        await lineRepository.delete({ orderId: id });
        await lineRepository.save(
          lines.map((line, index) =>
            lineRepository.create({ ...line, orderId: id, position: index }),
          ),
        );
      }
    });

    return (await this.findById(id)) as Order;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
