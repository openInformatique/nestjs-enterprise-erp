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
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { SkipResponseEnvelope } from '../../../common/decorators/skip-response-envelope.decorator';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { ListAuditLogsUseCase } from '../../audit/application/list-audit-logs.use-case';
import { AuditLogResponseDto } from '../../audit/presentation/dto/audit-log-response.dto';
import { CreateProductUseCase } from '../application/create-product.use-case';
import { DeleteProductUseCase } from '../application/delete-product.use-case';
import { ExportProductsUseCase } from '../application/export-products.use-case';
import { GetProductByIdUseCase } from '../application/get-product-by-id.use-case';
import { ListProductsUseCase } from '../application/list-products.use-case';
import { UpdateProductUseCase } from '../application/update-product.use-case';
import { CreateProductDto } from './dto/create-product.dto';
import { ExportProductsQueryDto } from './dto/export-products-query.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/**
 * Contrôleur des produits & services du catalogue.
 * Lecture ouverte à tous les rôles ; écriture ADMIN/MANAGER ;
 * suppression ADMIN.
 */
@ApiTags('Catalogue — Produits')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
    private readonly exportProductsUseCase: ExportProductsUseCase,
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des produits et services',
    description:
      'Filtres : categoryId, type, isActive, search (SKU / nom). ' +
      'La pagination est renvoyée dans meta.pagination.',
  })
  @ApiOkResponse({ type: [ProductResponseDto] })
  async list(
    @Query() query: ListProductsQueryDto,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    const result = await this.listProductsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      categoryId: query.categoryId,
      type: query.type,
      isActive: query.isActive,
    });

    return {
      items: result.items.map(ProductResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get('export')
  @Roles(UserRole.Admin, UserRole.Manager)
  @SkipResponseEnvelope()
  @ApiOperation({
    summary: 'Exporter le catalogue (CSV/XLSX)',
    description:
      'Mêmes filtres que la liste, SANS pagination — jusqu’à 10 000 ' +
      'lignes (422 au-delà). La colonne Catégorie est résolue par nom.',
  })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async export(
    @Query() query: ExportProductsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportProductsUseCase.execute(
      {
        type: query.type,
        categoryId: query.categoryId,
        search: query.search,
      },
      query.format,
    );

    const date = new Date().toISOString().slice(0, 10);
    response.setHeader(
      'Content-Type',
      query.format === ExportFormat.Xlsx
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="produits-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un produit" })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Produit inconnu ou supprimé.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductResponseDto> {
    const product = await this.getProductByIdUseCase.execute(id);
    return ProductResponseDto.fromDomain(product);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Créer un produit ou un service',
    description: 'SKU auto-généré (PROD-XXXX) si absent du corps.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiConflictResponse({
    description: 'SKU déjà utilisé (RESOURCE_ALREADY_EXISTS).',
  })
  async create(@Body() body: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.createProductUseCase.execute(body);
    return ProductResponseDto.fromDomain(product);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Modifier un produit' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Produit inconnu ou supprimé.' })
  @ApiConflictResponse({
    description: 'Nouveau SKU déjà utilisé (RESOURCE_ALREADY_EXISTS).',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.updateProductUseCase.execute(id, body);
    return ProductResponseDto.fromDomain(product);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Désactiver un produit (suppression logique)',
    description:
      'Le blocage « produit utilisé dans des devis/commandes actifs » ' +
      'arrivera avec les modules 05/06.',
  })
  @ApiNoContentResponse({ description: 'Produit désactivé.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteProductUseCase.execute(id);
  }

  @Get(':id/history')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: "Historique d'audit d'un produit" })
  @ApiOkResponse({ type: [AuditLogResponseDto] })
  async history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    const result = await this.listAuditLogsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortDirection: query.sortDirection,
      resourceType: 'product',
      resourceId: id,
    });

    return {
      items: result.items.map(AuditLogResponseDto.fromDomain),
      meta: result.meta,
    };
  }
}
