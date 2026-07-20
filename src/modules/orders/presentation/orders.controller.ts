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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { ListAuditLogsUseCase } from '../../audit/application/list-audit-logs.use-case';
import { AuditLogResponseDto } from '../../audit/presentation/dto/audit-log-response.dto';
import { InvoiceResponseDto } from '../../invoices/presentation/dto/invoice-response.dto';
import { CancelOrderUseCase } from '../application/cancel-order.use-case';
import { CompleteOrderUseCase } from '../application/complete-order.use-case';
import { ConvertOrderToInvoiceUseCase } from '../application/convert-order-to-invoice.use-case';
import { ConfirmOrderUseCase } from '../application/confirm-order.use-case';
import { CreateOrderUseCase } from '../application/create-order.use-case';
import { DeleteOrderUseCase } from '../application/delete-order.use-case';
import { ExportOrdersUseCase } from '../application/export-orders.use-case';
import { GetOrderByIdUseCase } from '../application/get-order-by-id.use-case';
import { ListOrdersUseCase } from '../application/list-orders.use-case';
import { StartDeliveryUseCase } from '../application/start-delivery.use-case';
import { UpdateOrderUseCase } from '../application/update-order.use-case';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ExportOrdersQueryDto } from './dto/export-orders-query.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { StartDeliveryDto } from './dto/start-delivery.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

/**
 * Contrôleur des commandes (clients et fournisseurs).
 * start/complete sont ouverts à tous les rôles : ce sont les gestes
 * du quotidien d'un magasinier.
 */
@ApiTags('Commandes')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly listOrdersUseCase: ListOrdersUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly updateOrderUseCase: UpdateOrderUseCase,
    private readonly deleteOrderUseCase: DeleteOrderUseCase,
    private readonly confirmOrderUseCase: ConfirmOrderUseCase,
    private readonly startDeliveryUseCase: StartDeliveryUseCase,
    private readonly completeOrderUseCase: CompleteOrderUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly convertOrderToInvoiceUseCase: ConvertOrderToInvoiceUseCase,
    private readonly exportOrdersUseCase: ExportOrdersUseCase,
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des commandes',
    description:
      'Filtres : type, status, contactId, from/to (création, ISO), ' +
      'search (numéro / nom du contact).',
  })
  @ApiOkResponse({ type: [OrderResponseDto] })
  async list(
    @Query() query: ListOrdersQueryDto,
  ): Promise<PaginatedResult<OrderResponseDto>> {
    const result = await this.listOrdersUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      type: query.type,
      status: query.status,
      contactId: query.contactId,
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(OrderResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get('export')
  @Roles(UserRole.Admin, UserRole.Manager)
  @SkipResponseEnvelope()
  @ApiOperation({
    summary: 'Exporter les commandes (CSV/XLSX)',
    description:
      'Mêmes filtres que la liste (dates sur la création), SANS ' +
      'pagination — jusqu’à 10 000 lignes (422 au-delà).',
  })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async export(
    @Query() query: ExportOrdersQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportOrdersUseCase.execute(
      {
        type: query.type,
        status: query.status,
        contactId: query.contactId,
        search: query.search,
        from: query.from !== undefined ? new Date(query.from) : undefined,
        to: query.to !== undefined ? new Date(query.to) : undefined,
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
      `attachment; filename="commandes-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une commande (avec ses lignes)" })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Commande inconnue.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    const order = await this.getOrderByIdUseCase.execute(id);
    return OrderResponseDto.fromDomain(order);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Créer une commande (statut DRAFT)',
    description:
      'Numéro auto : CMD-YYYY-NNNN (client) ou CDF-YYYY-NNNN ' +
      '(fournisseur). Totaux calculés côté serveur.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Contact ou produit inconnu.' })
  @ApiConflictResponse({
    description:
      'Contact incompatible avec le type, produit désactivé ou ligne ' +
      'libre incomplète.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.createOrderUseCase.execute(user, body);
    return OrderResponseDto.fromDomain(order);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Modifier une commande (DRAFT ou CONFIRMED)',
    description: 'Si `lines` est fourni : remplacement complet + recalcul.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Commande inconnue.' })
  @ApiConflictResponse({ description: 'Commande non modifiable.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.updateOrderUseCase.execute(id, body);
    return OrderResponseDto.fromDomain(order);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une commande (DRAFT uniquement)',
    description: 'Au-delà du brouillon : utiliser l’annulation.',
  })
  @ApiNoContentResponse({ description: 'Commande supprimée.' })
  @ApiConflictResponse({ description: 'Commande non supprimable.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteOrderUseCase.execute(id);
  }

  @Post(':id/confirm')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmer (DRAFT → CONFIRMED)' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async confirm(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    const order = await this.confirmOrderUseCase.execute(id);
    return OrderResponseDto.fromDomain(order);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Départ en livraison (CONFIRMED → IN_PROGRESS)',
    description:
      'Commande CLIENT : sort le stock de l’entrepôt indiqué ' +
      '(warehouseId obligatoire si produits stockés) — 409 si stock ' +
      'insuffisant, rien ne bouge.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiConflictResponse({
    description:
      'Transition invalide, entrepôt manquant/désactivé ou stock ' +
      'insuffisant.',
  })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StartDeliveryDto,
  ): Promise<OrderResponseDto> {
    const order = await this.startDeliveryUseCase.execute(user, id, body);
    return OrderResponseDto.fromDomain(order);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clôturer la livraison (IN_PROGRESS → DELIVERED)',
    description:
      'Commande FOURNISSEUR : fait entrer le stock dans l’entrepôt ' +
      'indiqué (warehouseId obligatoire si produits stockés), avec le ' +
      'prix d’achat comme coût du mouvement. Pose deliveredAt.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiConflictResponse({
    description: 'Transition invalide ou entrepôt manquant/désactivé.',
  })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CompleteOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.completeOrderUseCase.execute(user, id, body);
    return OrderResponseDto.fromDomain(order);
  }

  @Post(':id/cancel')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Annuler une commande',
    description:
      'Possible depuis tout statut sauf DELIVERED. Si la commande ' +
      '(CLIENT) était partie en livraison : le stock sorti est ' +
      'réinjecté (mouvements ANNULATION CMD-XXXX).',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiConflictResponse({
    description: 'Commande livrée ou déjà annulée.',
  })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    const order = await this.cancelOrderUseCase.execute(user, id);
    return OrderResponseDto.fromDomain(order);
  }

  @Post(':id/invoice')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Facturer une commande client livrée',
    description:
      'Crée une facture DRAFT (FAC-YYYY-NNNN) avec les lignes de la ' +
      'commande, prix figés. Une commande ne se facture qu’une fois.',
  })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiConflictResponse({
    description: 'Commande fournisseur, non livrée, ou déjà facturée.',
  })
  async invoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.convertOrderToInvoiceUseCase.execute(user, id);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Get(':id/history')
  @ApiOperation({ summary: "Historique d'audit d'une commande" })
  @ApiOkResponse({ type: [AuditLogResponseDto] })
  async history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    const result = await this.listAuditLogsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortDirection: query.sortDirection,
      resourceType: 'order',
      resourceId: id,
    });

    return {
      items: result.items.map(AuditLogResponseDto.fromDomain),
      meta: result.meta,
    };
  }
}
