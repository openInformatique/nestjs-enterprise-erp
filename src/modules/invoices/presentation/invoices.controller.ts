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
import { CancelInvoiceUseCase } from '../application/cancel-invoice.use-case';
import { CreateCreditNoteUseCase } from '../application/create-credit-note.use-case';
import { CreateInvoiceUseCase } from '../application/create-invoice.use-case';
import { DeleteInvoiceUseCase } from '../application/delete-invoice.use-case';
import { ExportInvoicesUseCase } from '../application/export-invoices.use-case';
import { GetInvoiceByIdUseCase } from '../application/get-invoice-by-id.use-case';
import { ListInvoicesUseCase } from '../application/list-invoices.use-case';
import { SendInvoiceUseCase } from '../application/send-invoice.use-case';
import { UpdateInvoiceUseCase } from '../application/update-invoice.use-case';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ExportInvoicesQueryDto } from './dto/export-invoices-query.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

/**
 * Contrôleur des factures et avoirs.
 * Lecture ouverte à tous les rôles ; écriture ADMIN/MANAGER ;
 * suppression (brouillons) ADMIN.
 */
@ApiTags('Factures')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly listInvoicesUseCase: ListInvoicesUseCase,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    private readonly updateInvoiceUseCase: UpdateInvoiceUseCase,
    private readonly deleteInvoiceUseCase: DeleteInvoiceUseCase,
    private readonly sendInvoiceUseCase: SendInvoiceUseCase,
    private readonly cancelInvoiceUseCase: CancelInvoiceUseCase,
    private readonly createCreditNoteUseCase: CreateCreditNoteUseCase,
    private readonly exportInvoicesUseCase: ExportInvoicesUseCase,
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des factures et avoirs',
    description:
      'Filtres : type, status, customerId, from/to (date d’ÉMISSION, ' +
      'ISO), search (numéro / nom du client).',
  })
  @ApiOkResponse({ type: [InvoiceResponseDto] })
  async list(
    @Query() query: ListInvoicesQueryDto,
  ): Promise<PaginatedResult<InvoiceResponseDto>> {
    const result = await this.listInvoicesUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      type: query.type,
      status: query.status,
      customerId: query.customerId,
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(InvoiceResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get('export')
  @Roles(UserRole.Admin, UserRole.Manager)
  @SkipResponseEnvelope()
  @ApiOperation({
    summary: 'Exporter factures et avoirs (CSV/XLSX)',
    description:
      'Mêmes filtres que la liste (dates sur l’émission), SANS ' +
      'pagination — jusqu’à 10 000 lignes (422 au-delà).',
  })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async export(
    @Query() query: ExportInvoicesQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportInvoicesUseCase.execute(
      {
        type: query.type,
        status: query.status,
        customerId: query.customerId,
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
      `attachment; filename="factures-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une facture (avec ses lignes)" })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiNotFoundResponse({ description: 'Facture inconnue.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.getInvoiceByIdUseCase.execute(id);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Créer une facture manuelle (statut DRAFT)',
    description:
      'Numéro auto FAC-YYYY-NNNN, échéance par défaut +30 jours. Pour ' +
      'facturer une commande livrée : POST /orders/:id/invoice.',
  })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiNotFoundResponse({ description: 'Client ou produit inconnu.' })
  @ApiConflictResponse({
    description:
      'Contact non client, produit désactivé, ligne libre incomplète ' +
      'ou échéance antérieure à l’émission.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.createInvoiceUseCase.execute(user, body);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Modifier une facture (DRAFT uniquement)',
    description: 'Émise, une facture se corrige par un AVOIR.',
  })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiNotFoundResponse({ description: 'Facture inconnue.' })
  @ApiConflictResponse({ description: 'Facture non modifiable.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.updateInvoiceUseCase.execute(id, body);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une facture (DRAFT uniquement)',
    description: 'Une facture émise ne disparaît jamais (pièce comptable).',
  })
  @ApiNoContentResponse({ description: 'Facture supprimée.' })
  @ApiConflictResponse({ description: 'Facture non supprimable.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteInvoiceUseCase.execute(id);
  }

  @Post(':id/send')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Émettre une facture (DRAFT → SENT)',
    description:
      'LE POINT DE NON-RETOUR : plus de modification ni de suppression ' +
      'ensuite. PDF + e-mail arrivent au niveau min-.',
  })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async send(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.sendInvoiceUseCase.execute(id);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Post(':id/cancel')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Annuler une facture (DRAFT ou SENT)',
    description: 'Payée même partiellement : créer un avoir à la place.',
  })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiConflictResponse({
    description: 'Facture payée (même partiellement) ou déjà annulée.',
  })
  async cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.cancelInvoiceUseCase.execute(id);
    return InvoiceResponseDto.fromDomain(invoice);
  }

  @Post(':id/credit-note')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Créer un avoir depuis une facture émise',
    description:
      'Sans lignes : avoir TOTAL (copie de la source). Avec lignes : ' +
      'avoir PARTIEL. Numéroté AV-YYYY-NNNN, lié par creditNoteForId.',
  })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiConflictResponse({
    description: 'Facture non émise, ou déjà un avoir.',
  })
  async createCreditNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateCreditNoteDto,
  ): Promise<InvoiceResponseDto> {
    const creditNote = await this.createCreditNoteUseCase.execute(
      user,
      id,
      body,
    );
    return InvoiceResponseDto.fromDomain(creditNote);
  }

  @Get(':id/history')
  @ApiOperation({ summary: "Historique d'audit d'une facture" })
  @ApiOkResponse({ type: [AuditLogResponseDto] })
  async history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    const result = await this.listAuditLogsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortDirection: query.sortDirection,
      resourceType: 'invoice',
      resourceId: id,
    });

    return {
      items: result.items.map(AuditLogResponseDto.fromDomain),
      meta: result.meta,
    };
  }
}
