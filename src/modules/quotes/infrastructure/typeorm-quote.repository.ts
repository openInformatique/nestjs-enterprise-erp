import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { TransactionService } from '../../../database/transaction/transaction.service';
import { Quote } from '../domain/quote';
import {
  CreateQuoteData,
  ListQuotesQuery,
  QuoteRepositoryPort,
  UpdateQuoteData,
} from '../domain/quote-repository.port';
import { QuoteStatus } from '../domain/quote-status.enum';
import { QuoteEntity } from './entities/quote.entity';
import { QuoteLineEntity } from './entities/quote-line.entity';
import { QuoteMapper } from './quote.mapper';

/** Liste blanche de tri (colonnes du devis + client joint). */
const QUOTE_SORTABLE_COLUMNS: ColumnWhitelist = {
  number: 'quote.number',
  status: 'quote.status',
  validUntil: 'quote.validUntil',
  totalTTC: 'quote.totalTTC',
  customerName: 'customer.companyName',
  createdAt: 'quote.createdAt',
};

/** Recherche textuelle : numéro du devis et nom du client. */
const QUOTE_SEARCHABLE_COLUMNS = [
  'quote.number',
  'customer.companyName',
] as const;

/** Implémentation TypeORM du repository devis. */
@Injectable()
export class TypeOrmQuoteRepository implements QuoteRepositoryPort {
  constructor(
    @InjectRepository(QuoteEntity)
    private readonly repository: Repository<QuoteEntity>,
    private readonly transactionService: TransactionService,
    private readonly mapper: QuoteMapper,
  ) {}

  async findAll(query: ListQuotesQuery): Promise<PaginatedResult<Quote>> {
    // Client joint pour le nom ; PAS les lignes (inutiles en liste,
    // et une jointure OneToMany multiplierait les lignes de résultat).
    const queryBuilder = this.repository
      .createQueryBuilder('quote')
      .innerJoinAndSelect('quote.customer', 'customer');

    if (query.status !== undefined) {
      queryBuilder.andWhere('quote.status = :status', {
        status: query.status,
      });
    }
    if (query.customerId !== undefined) {
      queryBuilder.andWhere('quote.customerId = :customerId', {
        customerId: query.customerId,
      });
    }
    if (query.from !== undefined) {
      queryBuilder.andWhere('quote.createdAt >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('quote.createdAt <= :to', { to: query.to });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      QUOTE_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      queryBuilder.orderBy('quote.createdAt', SortDirection.Desc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        QUOTE_SORTABLE_COLUMNS,
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

  async findById(id: string): Promise<Quote | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { customer: true, lines: true },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findExpired(now: Date): Promise<Quote[]> {
    const entities = await this.repository.find({
      where: { status: QuoteStatus.Sent, validUntil: LessThan(now) },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DEV-${year}-`;

    // MAX du numéro de l'année : la séquence ne dépend pas d'un COUNT
    // (qui redescendrait après suppression d'un brouillon).
    const raw = await this.repository
      .createQueryBuilder('quote')
      .select('MAX(quote.number)', 'max')
      .where('quote.number LIKE :prefix', { prefix: `${prefix}%` })
      .getRawOne<{ max: string | null }>();

    const lastSequence = raw?.max ? Number(raw.max.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
  }

  async create(data: CreateQuoteData): Promise<Quote> {
    const { lines, ...quoteColumns } = data;

    // cascade: ['insert'] : le devis ET ses lignes partent dans le même
    // save() — TypeORM ouvre une transaction pour l'ensemble.
    const entity = this.repository.create({
      ...quoteColumns,
      lines: lines.map((line, index) => ({ ...line, position: index })),
    });
    const saved = await this.repository.save(entity);

    // Relecture : renvoie l'état complet (client joint, lignes triées).
    return (await this.findById(saved.id)) as Quote;
  }

  async update(id: string, data: UpdateQuoteData): Promise<Quote> {
    const { lines, ...quoteColumns } = data;

    await this.transactionService.execute(async (manager) => {
      const changes: Partial<QuoteEntity> = {};
      for (const [key, value] of Object.entries(quoteColumns)) {
        if (value !== undefined) {
          (changes as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(changes).length > 0) {
        await manager.getRepository(QuoteEntity).update({ id }, changes);
      }

      // Remplacement COMPLET des lignes : plus simple et plus sûr que
      // de réconcilier ligne à ligne (le devis est encore un brouillon).
      if (lines !== undefined) {
        const lineRepository = manager.getRepository(QuoteLineEntity);
        await lineRepository.delete({ quoteId: id });
        await lineRepository.save(
          lines.map((line, index) =>
            lineRepository.create({ ...line, quoteId: id, position: index }),
          ),
        );
      }
    });

    return (await this.findById(id)) as Quote;
  }

  async updateStatus(id: string, status: QuoteStatus): Promise<void> {
    await this.repository.update({ id }, { status });
  }

  async delete(id: string): Promise<void> {
    // Suppression physique : les lignes suivent via ON DELETE CASCADE.
    await this.repository.delete({ id });
  }
}
