import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { DeletePaymentUseCase } from '../application/delete-payment.use-case';
import { ExportPaymentsUseCase } from '../application/export-payments.use-case';
import { GetOverdueSummaryUseCase } from '../application/get-overdue-summary.use-case';
import { GetPaymentByIdUseCase } from '../application/get-payment-by-id.use-case';
import { ListPaymentsUseCase } from '../application/list-payments.use-case';
import { RecordPaymentUseCase } from '../application/record-payment.use-case';
import { ExportPaymentsQueryDto } from './dto/export-payments-query.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { OverdueInvoiceSummaryDto } from './dto/overdue-invoice-summary.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

/**
 * Contrôleur des paiements.
 * Tout est ADMIN/MANAGER (les encaissements sont de la gestion, pas de
 * la consultation d'équipe) ; la suppression est ADMIN seul.
 */
@ApiTags('Paiements')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly listPaymentsUseCase: ListPaymentsUseCase,
    private readonly getPaymentByIdUseCase: GetPaymentByIdUseCase,
    private readonly recordPaymentUseCase: RecordPaymentUseCase,
    private readonly deletePaymentUseCase: DeletePaymentUseCase,
    private readonly getOverdueSummaryUseCase: GetOverdueSummaryUseCase,
    private readonly exportPaymentsUseCase: ExportPaymentsUseCase,
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
  ) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Liste paginée des paiements',
    description:
      'Filtres : invoiceId, method, from/to (date de VALEUR, ISO). ' +
      'Tri par défaut : paidAt décroissant.',
  })
  @ApiOkResponse({ type: [PaymentResponseDto] })
  async list(
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaginatedResult<PaymentResponseDto>> {
    const result = await this.listPaymentsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      invoiceId: query.invoiceId,
      method: query.method,
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(PaymentResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  // DÉCLARÉE AVANT :id — sinon « overdue » serait avalé comme un id.
  @Get('overdue')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Résumé des impayés',
    description:
      'Factures OVERDUE + PARTIALLY_PAID, triées par reste à payer ' +
      'décroissant, avec client (nom, e-mail), jours de retard et ' +
      'paiements déjà reçus.',
  })
  @ApiOkResponse({ type: [OverdueInvoiceSummaryDto] })
  async overdueSummary(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<OverdueInvoiceSummaryDto>> {
    const result = await this.getOverdueSummaryUseCase.execute({
      page: query.page,
      limit: query.limit,
    });

    return {
      items: result.items.map(OverdueInvoiceSummaryDto.fromSummary),
      meta: result.meta,
    };
  }

  // DÉCLARÉE AVANT :id — même raison que « overdue » ci-dessus.
  @Get('export')
  @Roles(UserRole.Admin, UserRole.Manager)
  @SkipResponseEnvelope()
  @ApiOperation({
    summary: 'Exporter les paiements (CSV/XLSX)',
    description:
      'Mêmes filtres que la liste (dates de valeur), SANS pagination — ' +
      'jusqu’à 10 000 lignes (422 au-delà).',
  })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async export(
    @Query() query: ExportPaymentsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportPaymentsUseCase.execute(
      {
        invoiceId: query.invoiceId,
        method: query.method,
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
      `attachment; filename="paiements-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: "Détail d'un paiement" })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({ description: 'Paiement inconnu.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.getPaymentByIdUseCase.execute(id);
    return PaymentResponseDto.fromDomain(payment);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Enregistrer un encaissement',
    description:
      'Facture SENT, OVERDUE ou PARTIALLY_PAID uniquement ; montant ' +
      'plafonné au reste à payer. paidAmount et statut de la facture ' +
      'recalculés (PARTIALLY_PAID, ou PAID si soldée).',
  })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({ description: 'Facture inconnue.' })
  @ApiConflictResponse({
    description:
      'Facture non encaissable (brouillon, soldée, annulée, avoir) ou ' +
      'montant supérieur au solde.',
  })
  async record(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordPaymentDto,
  ): Promise<PaymentResponseDto> {
    const payment = await this.recordPaymentUseCase.execute(user, body);
    return PaymentResponseDto.fromDomain(payment);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un paiement (saisie erronée)',
    description:
      'ADMIN uniquement. paidAmount et statut de la facture recalculés ' +
      '(retour possible à SENT, OVERDUE ou PARTIALLY_PAID).',
  })
  @ApiNoContentResponse({ description: 'Paiement supprimé.' })
  @ApiNotFoundResponse({ description: 'Paiement inconnu.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deletePaymentUseCase.execute(id);
  }

  @Get(':id/history')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: "Historique d'audit d'un paiement" })
  @ApiOkResponse({ type: [AuditLogResponseDto] })
  async history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    const result = await this.listAuditLogsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortDirection: query.sortDirection,
      resourceType: 'payment',
      resourceId: id,
    });

    return {
      items: result.items.map(AuditLogResponseDto.fromDomain),
      meta: result.meta,
    };
  }
}
