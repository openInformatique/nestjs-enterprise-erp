import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { AdjustStockUseCase } from '../application/adjust-stock.use-case';
import { GetStockLevelsUseCase } from '../application/get-stock-levels.use-case';
import { ListStockMovementsUseCase } from '../application/list-stock-movements.use-case';
import { RecordStockInUseCase } from '../application/record-stock-in.use-case';
import { RecordStockOutUseCase } from '../application/record-stock-out.use-case';
import { TransferStockUseCase } from '../application/transfer-stock.use-case';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ListStockLevelsQueryDto } from './dto/list-stock-levels-query.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { RecordStockInDto } from './dto/record-stock-in.dto';
import { RecordStockOutDto } from './dto/record-stock-out.dto';
import { StockLevelResponseDto } from './dto/stock-level-response.dto';
import { StockMovementResponseDto } from './dto/stock-movement-response.dto';
import { TransferResultDto } from './dto/transfer-result.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';

/**
 * Contrôleur du stock : consultation des niveaux, historique des
 * mouvements, et les quatre écritures (in / out / transfer / adjust).
 *
 * Entrées et sorties sont ouvertes à tous les rôles (opérations du
 * quotidien d'un magasinier) ; transfert et ajustement, plus sensibles,
 * sont réservés ADMIN/MANAGER.
 */
@ApiTags('Stocks')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(
    private readonly getStockLevelsUseCase: GetStockLevelsUseCase,
    private readonly listStockMovementsUseCase: ListStockMovementsUseCase,
    private readonly recordStockInUseCase: RecordStockInUseCase,
    private readonly recordStockOutUseCase: RecordStockOutUseCase,
    private readonly transferStockUseCase: TransferStockUseCase,
    private readonly adjustStockUseCase: AdjustStockUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Niveaux de stock (paginés, enrichis)',
    description:
      'Filtres : productId, warehouseId, lowStock (quantité < 5), ' +
      'search (SKU / nom du produit).',
  })
  @ApiOkResponse({ type: [StockLevelResponseDto] })
  async getLevels(
    @Query() query: ListStockLevelsQueryDto,
  ): Promise<PaginatedResult<StockLevelResponseDto>> {
    const result = await this.getStockLevelsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      productId: query.productId,
      warehouseId: query.warehouseId,
      lowStock: query.lowStock,
    });

    return {
      items: result.items.map(StockLevelResponseDto.fromView),
      meta: result.meta,
    };
  }

  @Get('movements')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Historique des mouvements (paginé)',
    description:
      'Filtres : productId, warehouseId, type, from/to (ISO 8601), ' +
      'search (référence / notes). Tri par défaut : plus récents d’abord.',
  })
  @ApiOkResponse({ type: [StockMovementResponseDto] })
  async listMovements(
    @Query() query: ListStockMovementsQueryDto,
  ): Promise<PaginatedResult<StockMovementResponseDto>> {
    const result = await this.listStockMovementsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      productId: query.productId,
      warehouseId: query.warehouseId,
      type: query.type,
      // Les query params sont du texte : conversion en Date ici, la
      // validation du format ISO ayant déjà été faite par le DTO.
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(StockMovementResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Post('in')
  @ApiOperation({ summary: 'Entrée de stock (réception, achat)' })
  @ApiCreatedResponse({ type: StockMovementResponseDto })
  @ApiNotFoundResponse({ description: 'Produit ou entrepôt inconnu.' })
  @ApiConflictResponse({
    description: 'Article SERVICE ou entrepôt désactivé.',
  })
  async recordIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordStockInDto,
  ): Promise<StockMovementResponseDto> {
    const movement = await this.recordStockInUseCase.execute(user, body);
    return StockMovementResponseDto.fromDomain(movement);
  }

  @Post('out')
  @ApiOperation({ summary: 'Sortie de stock (vente, consommation)' })
  @ApiCreatedResponse({ type: StockMovementResponseDto })
  @ApiNotFoundResponse({ description: 'Produit ou entrepôt inconnu.' })
  @ApiConflictResponse({
    description: 'Stock insuffisant, article SERVICE ou entrepôt désactivé.',
  })
  async recordOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordStockOutDto,
  ): Promise<StockMovementResponseDto> {
    const movement = await this.recordStockOutUseCase.execute(user, body);
    return StockMovementResponseDto.fromDomain(movement);
  }

  @Post('transfer')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Transfert entre entrepôts (atomique)',
    description:
      'Écrit 2 mouvements + 2 niveaux dans UNE transaction SQL : tout ' +
      'réussit ou tout est annulé.',
  })
  @ApiCreatedResponse({ type: TransferResultDto })
  @ApiNotFoundResponse({ description: 'Produit ou entrepôt inconnu.' })
  @ApiConflictResponse({
    description:
      'Source = cible, stock source insuffisant, article SERVICE ou ' +
      'entrepôt désactivé.',
  })
  async transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: TransferStockDto,
  ): Promise<TransferResultDto> {
    const result = await this.transferStockUseCase.execute(user, body);
    return TransferResultDto.fromResult(result);
  }

  @Post('adjust')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: "Ajustement d'inventaire",
    description:
      'newQuantity = quantité réellement comptée. Notes obligatoires ; ' +
      'l’écart (stock : X → Y) y est ajouté automatiquement.',
  })
  @ApiCreatedResponse({ type: StockMovementResponseDto })
  @ApiNotFoundResponse({ description: 'Produit ou entrepôt inconnu.' })
  @ApiConflictResponse({
    description: 'Aucun écart, article SERVICE ou entrepôt désactivé.',
  })
  async adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AdjustStockDto,
  ): Promise<StockMovementResponseDto> {
    const movement = await this.adjustStockUseCase.execute(user, body);
    return StockMovementResponseDto.fromDomain(movement);
  }
}
