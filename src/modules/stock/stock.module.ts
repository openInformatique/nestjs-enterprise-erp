import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { AdjustStockUseCase } from './application/adjust-stock.use-case';
import { CreateWarehouseUseCase } from './application/create-warehouse.use-case';
import { DeactivateWarehouseUseCase } from './application/deactivate-warehouse.use-case';
import { GetStockLevelsUseCase } from './application/get-stock-levels.use-case';
import { GetWarehouseByIdUseCase } from './application/get-warehouse-by-id.use-case';
import { ListStockMovementsUseCase } from './application/list-stock-movements.use-case';
import { ListWarehousesUseCase } from './application/list-warehouses.use-case';
import { RecordStockInUseCase } from './application/record-stock-in.use-case';
import { RecordStockOutUseCase } from './application/record-stock-out.use-case';
import { TransferStockUseCase } from './application/transfer-stock.use-case';
import { UpdateWarehouseUseCase } from './application/update-warehouse.use-case';
import { STOCK_LEVEL_REPOSITORY } from './domain/stock-level-repository.port';
import { STOCK_MOVEMENT_REPOSITORY } from './domain/stock-movement-repository.port';
import { STOCK_WRITER } from './domain/stock-writer.port';
import { WAREHOUSE_REPOSITORY } from './domain/warehouse-repository.port';
import { StockLevelEntity } from './infrastructure/entities/stock-level.entity';
import { StockMovementEntity } from './infrastructure/entities/stock-movement.entity';
import { WarehouseEntity } from './infrastructure/entities/warehouse.entity';
import { StockLevelMapper } from './infrastructure/stock-level.mapper';
import { StockMovementMapper } from './infrastructure/stock-movement.mapper';
import { TransactionalStockWriter } from './infrastructure/transactional-stock-writer';
import { TypeOrmStockLevelRepository } from './infrastructure/typeorm-stock-level.repository';
import { TypeOrmStockMovementRepository } from './infrastructure/typeorm-stock-movement.repository';
import { TypeOrmWarehouseRepository } from './infrastructure/typeorm-warehouse.repository';
import { WarehouseMapper } from './infrastructure/warehouse.mapper';
import { StockController } from './presentation/stock.controller';
import { WarehousesController } from './presentation/warehouses.controller';

/**
 * Module de gestion des stocks (entrepôts, niveaux, mouvements).
 *
 * Imports :
 *   - CatalogueModule : fournit GetProductByIdUseCase (validation des
 *     produits mouvementés) ;
 *   - DatabaseModule : fournit TransactionService (writer atomique).
 *     NestJS n'instancie chaque module qu'UNE fois : l'importer ici ne
 *     crée pas de seconde connexion SQL.
 *
 * STOCK_LEVEL_REPOSITORY, STOCK_WRITER et WAREHOUSE_REPOSITORY sont
 * exportés : le module commandes (06) en aura besoin pour mouvementer
 * le stock à la livraison/réception et valider l'entrepôt choisi.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseEntity,
      StockLevelEntity,
      StockMovementEntity,
    ]),
    CatalogueModule,
    DatabaseModule,
  ],
  controllers: [WarehousesController, StockController],
  providers: [
    WarehouseMapper,
    StockLevelMapper,
    StockMovementMapper,
    ListWarehousesUseCase,
    GetWarehouseByIdUseCase,
    CreateWarehouseUseCase,
    UpdateWarehouseUseCase,
    DeactivateWarehouseUseCase,
    GetStockLevelsUseCase,
    ListStockMovementsUseCase,
    RecordStockInUseCase,
    RecordStockOutUseCase,
    TransferStockUseCase,
    AdjustStockUseCase,
    {
      provide: WAREHOUSE_REPOSITORY,
      useClass: TypeOrmWarehouseRepository,
    },
    {
      provide: STOCK_LEVEL_REPOSITORY,
      useClass: TypeOrmStockLevelRepository,
    },
    {
      provide: STOCK_MOVEMENT_REPOSITORY,
      useClass: TypeOrmStockMovementRepository,
    },
    {
      provide: STOCK_WRITER,
      useClass: TransactionalStockWriter,
    },
  ],
  exports: [STOCK_LEVEL_REPOSITORY, STOCK_WRITER, WAREHOUSE_REPOSITORY],
})
export class StockModule {}
