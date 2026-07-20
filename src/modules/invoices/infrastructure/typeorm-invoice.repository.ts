import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { TransactionService } from '../../../database/transaction/transaction.service';
import { Invoice } from '../domain/invoice';
import {
  CreateInvoiceData,
  InvoiceRepositoryPort,
  ListInvoicesQuery,
  UpdateInvoiceData,
} from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { InvoiceType } from '../domain/invoice-type.enum';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceLineEntity } from './entities/invoice-line.entity';
import { InvoiceMapper } from './invoice.mapper';

/** Liste blanche de tri (colonnes de la facture + client joint). */
const INVOICE_SORTABLE_COLUMNS: ColumnWhitelist = {
  number: 'invoice.number',
  type: 'invoice.type',
  status: 'invoice.status',
  issueDate: 'invoice.issueDate',
  dueDate: 'invoice.dueDate',
  totalTTC: 'invoice.totalTTC',
  customerName: 'customer.companyName',
  createdAt: 'invoice.createdAt',
};

/** Recherche textuelle : numéro et nom du client. */
const INVOICE_SEARCHABLE_COLUMNS = [
  'invoice.number',
  'customer.companyName',
] as const;

/** Implémentation TypeORM du repository factures. */
@Injectable()
export class TypeOrmInvoiceRepository implements InvoiceRepositoryPort {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly repository: Repository<InvoiceEntity>,
    private readonly transactionService: TransactionService,
    private readonly mapper: InvoiceMapper,
  ) {}

  async findAll(query: ListInvoicesQuery): Promise<PaginatedResult<Invoice>> {
    const queryBuilder = this.repository
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.customer', 'customer');

    if (query.type !== undefined) {
      queryBuilder.andWhere('invoice.type = :type', { type: query.type });
    }
    if (query.status !== undefined) {
      queryBuilder.andWhere('invoice.status = :status', {
        status: query.status,
      });
    }
    if (query.customerId !== undefined) {
      queryBuilder.andWhere('invoice.customerId = :customerId', {
        customerId: query.customerId,
      });
    }
    // Bornes sur la date d'ÉMISSION : c'est elle qui a un sens
    // comptable (période de facturation), pas la date technique.
    if (query.from !== undefined) {
      queryBuilder.andWhere('invoice.issueDate >= :from', {
        from: query.from,
      });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('invoice.issueDate <= :to', { to: query.to });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      INVOICE_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('invoice.createdAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        INVOICE_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Invoice | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { customer: true, lines: true },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findOverdue(now: Date): Promise<Invoice[]> {
    // In() : WHERE status IN ('SENT', 'PARTIALLY_PAID').
    const entities = await this.repository.find({
      where: {
        status: In([InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid]),
        dueDate: LessThan(now),
      },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findUnpaid(query: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<Invoice>> {
    const queryBuilder = this.repository
      .createQueryBuilder('invoice')
      .innerJoinAndSelect('invoice.customer', 'customer')
      .where('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.Overdue, InvoiceStatus.PartiallyPaid],
      })
      // Reste à payer décroissant : les plus gros impayés d'abord.
      // Expression SQL brute : noms de COLONNES (total_ttc), pas de
      // propriétés — orderBy ne traduit pas les expressions.
      .orderBy('(invoice.total_ttc - invoice.paid_amount)', 'DESC');

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

  existsForOrder(orderId: string): Promise<boolean> {
    return this.repository.exists({ where: { orderId } });
  }

  async nextNumber(type: InvoiceType): Promise<string> {
    const year = new Date().getFullYear();
    // Deux séquences dans la même table : FAC- et AV-, chacune son MAX.
    const prefix = `${type === InvoiceType.Invoice ? 'FAC' : 'AV'}-${year}-`;

    const raw = await this.repository
      .createQueryBuilder('invoice')
      .select('MAX(invoice.number)', 'max')
      .where('invoice.number LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    const lastSequence = raw?.max ? Number(raw.max.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
  }

  async create(data: CreateInvoiceData): Promise<Invoice> {
    const { lines, ...invoiceColumns } = data;

    const entity = this.repository.create({
      ...invoiceColumns,
      lines: lines.map((line, index) => ({ ...line, position: index })),
    });
    const saved = await this.repository.save(entity);

    return (await this.findById(saved.id)) as Invoice;
  }

  async update(id: string, data: UpdateInvoiceData): Promise<Invoice> {
    const { lines, ...invoiceColumns } = data;

    await this.transactionService.execute(async (manager) => {
      const changes: Partial<InvoiceEntity> = {};
      for (const [key, value] of Object.entries(invoiceColumns)) {
        if (value !== undefined) {
          (changes as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(changes).length > 0) {
        await manager.getRepository(InvoiceEntity).update({ id }, changes);
      }

      if (lines !== undefined) {
        const lineRepository = manager.getRepository(InvoiceLineEntity);
        await lineRepository.delete({ invoiceId: id });
        await lineRepository.save(
          lines.map((line, index) =>
            lineRepository.create({ ...line, invoiceId: id, position: index }),
          ),
        );
      }
    });

    return (await this.findById(id)) as Invoice;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
