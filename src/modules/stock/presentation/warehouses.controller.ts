import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { CreateWarehouseUseCase } from '../application/create-warehouse.use-case';
import { DeactivateWarehouseUseCase } from '../application/deactivate-warehouse.use-case';
import { GetWarehouseByIdUseCase } from '../application/get-warehouse-by-id.use-case';
import { ListWarehousesUseCase } from '../application/list-warehouses.use-case';
import { UpdateWarehouseUseCase } from '../application/update-warehouse.use-case';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseResponseDto } from './dto/warehouse-response.dto';

/**
 * Contrôleur des entrepôts.
 * Lecture ouverte à tous les rôles ; création/désactivation ADMIN ;
 * modification ADMIN/MANAGER.
 */
@ApiTags('Stocks — Entrepôts')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(
    private readonly listWarehousesUseCase: ListWarehousesUseCase,
    private readonly getWarehouseByIdUseCase: GetWarehouseByIdUseCase,
    private readonly createWarehouseUseCase: CreateWarehouseUseCase,
    private readonly updateWarehouseUseCase: UpdateWarehouseUseCase,
    private readonly deactivateWarehouseUseCase: DeactivateWarehouseUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste des entrepôts (non paginée)',
    description: 'Filtre optionnel : isActive.',
  })
  @ApiOkResponse({ type: [WarehouseResponseDto] })
  async list(
    @Query() query: ListWarehousesQueryDto,
  ): Promise<WarehouseResponseDto[]> {
    const warehouses = await this.listWarehousesUseCase.execute({
      isActive: query.isActive,
    });
    return warehouses.map(WarehouseResponseDto.fromDomain);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un entrepôt" })
  @ApiOkResponse({ type: WarehouseResponseDto })
  @ApiNotFoundResponse({ description: 'Entrepôt inconnu.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.getWarehouseByIdUseCase.execute(id);
    return WarehouseResponseDto.fromDomain(warehouse);
  }

  @Post()
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Créer un entrepôt' })
  @ApiCreatedResponse({ type: WarehouseResponseDto })
  @ApiConflictResponse({
    description: 'Code déjà utilisé (RESOURCE_ALREADY_EXISTS).',
  })
  async create(
    @Body() body: CreateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.createWarehouseUseCase.execute(body);
    return WarehouseResponseDto.fromDomain(warehouse);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Modifier un entrepôt',
    description:
      'isActive: true réactive ; isActive: false est refusé (utiliser ' +
      'DELETE, qui vérifie que l’entrepôt est vide).',
  })
  @ApiOkResponse({ type: WarehouseResponseDto })
  @ApiNotFoundResponse({ description: 'Entrepôt inconnu.' })
  @ApiConflictResponse({
    description: 'Code déjà utilisé, ou tentative de désactivation via PATCH.',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.updateWarehouseUseCase.execute(id, body);
    return WarehouseResponseDto.fromDomain(warehouse);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Désactiver un entrepôt',
    description: 'Refusé (409) si du stock reste dedans. Idempotent.',
  })
  @ApiNoContentResponse({ description: 'Entrepôt désactivé.' })
  @ApiConflictResponse({
    description: 'Entrepôt non vide (BUSINESS_RULE_VIOLATION).',
  })
  async deactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.deactivateWarehouseUseCase.execute(id);
  }
}
