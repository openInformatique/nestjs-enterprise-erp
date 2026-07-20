import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Warehouse } from '../domain/warehouse';
import {
  CreateWarehouseData,
  ListWarehousesFilters,
  UpdateWarehouseData,
  WarehouseRepositoryPort,
} from '../domain/warehouse-repository.port';
import { WarehouseEntity } from './entities/warehouse.entity';
import { WarehouseMapper } from './warehouse.mapper';

/**
 * Implémentation TypeORM du repository entrepôts.
 * Volume faible : l'API simple repository.find() suffit.
 */
@Injectable()
export class TypeOrmWarehouseRepository implements WarehouseRepositoryPort {
  constructor(
    @InjectRepository(WarehouseEntity)
    private readonly repository: Repository<WarehouseEntity>,
    private readonly mapper: WarehouseMapper,
  ) {}

  async findAll(filters: ListWarehousesFilters): Promise<Warehouse[]> {
    const where: FindOptionsWhere<WarehouseEntity> = {};
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const entities = await this.repository.find({
      where,
      order: { name: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findById(id: string): Promise<Warehouse | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByCode(code: string): Promise<Warehouse | null> {
    const entity = await this.repository.findOne({ where: { code } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async create(data: CreateWarehouseData): Promise<Warehouse> {
    const entity = await this.repository.save(
      this.repository.create({ ...data, isActive: true }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateWarehouseData): Promise<Warehouse> {
    // undefined = « non fourni » : seuls les champs présents sont écrits.
    const changes: Partial<WarehouseEntity> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (changes as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }

    const entity = await this.repository.findOne({ where: { id } });
    // L'appelant (use case) a vérifié l'existence avant de modifier.
    return this.mapper.toDomain(entity as WarehouseEntity);
  }

  async deactivate(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: false });
  }
}
