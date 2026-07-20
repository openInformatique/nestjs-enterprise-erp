import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { roundMoney } from '../../../common/money/money';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { Payment } from '../domain/payment';
import {
  CreatePaymentData,
  ListPaymentsQuery,
  PaymentRepositoryPort,
} from '../domain/payment-repository.port';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentMapper } from './payment.mapper';

/** Liste blanche de tri. */
const PAYMENT_SORTABLE_COLUMNS: ColumnWhitelist = {
  paidAt: 'payment.paidAt',
  amount: 'payment.amount',
  method: 'payment.method',
  createdAt: 'payment.createdAt',
};

/** Implémentation TypeORM du repository paiements. */
@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepositoryPort {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repository: Repository<PaymentEntity>,
    private readonly mapper: PaymentMapper,
  ) {}

  async findAll(query: ListPaymentsQuery): Promise<PaginatedResult<Payment>> {
    const queryBuilder = this.repository.createQueryBuilder('payment');

    if (query.invoiceId !== undefined) {
      queryBuilder.andWhere('payment.invoiceId = :invoiceId', {
        invoiceId: query.invoiceId,
      });
    }
    if (query.method !== undefined) {
      queryBuilder.andWhere('payment.method = :method', {
        method: query.method,
      });
    }
    // Bornes sur la date de VALEUR : c'est elle qui a un sens pour la
    // trésorerie, pas la date technique de saisie.
    if (query.from !== undefined) {
      queryBuilder.andWhere('payment.paidAt >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('payment.paidAt <= :to', { to: query.to });
    }

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('payment.paidAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        PAYMENT_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Payment | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    const entities = await this.repository.find({
      where: { invoiceId },
      order: { paidAt: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async sumByInvoice(invoiceId: string): Promise<number> {
    // getRawOne : pas d'entité hydratée, donc pas de transformer —
    // Number() convertit ce que renvoie le driver, roundMoney verrouille.
    const raw = await this.repository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'sum')
      .where('payment.invoiceId = :invoiceId', { invoiceId })
      .getRawOne<{ sum: string | number | null }>();

    return roundMoney(Number(raw?.sum ?? 0));
  }

  async create(data: CreatePaymentData): Promise<Payment> {
    const entity = this.repository.create(data);
    const saved = await this.repository.save(entity);
    return this.mapper.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
