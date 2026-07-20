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
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { CreateContactUseCase } from '../application/create-contact.use-case';
import { DeleteContactUseCase } from '../application/delete-contact.use-case';
import { ExportContactsUseCase } from '../application/export-contacts.use-case';
import { GetContactByIdUseCase } from '../application/get-contact-by-id.use-case';
import { ListContactsUseCase } from '../application/list-contacts.use-case';
import { UpdateContactUseCase } from '../application/update-contact.use-case';
import { ContactResponseDto } from './dto/contact-response.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { ExportContactsQueryDto } from './dto/export-contacts-query.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

/**
 * Contrôleur des contacts (clients & fournisseurs).
 *
 * Lecture ouverte à tout utilisateur authentifié (un EMPLOYEE consulte
 * les clients pour préparer devis et commandes) ; écriture réservée à
 * ADMIN/MANAGER ; suppression à ADMIN seul.
 */
@ApiTags('Contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly listContactsUseCase: ListContactsUseCase,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly createContactUseCase: CreateContactUseCase,
    private readonly updateContactUseCase: UpdateContactUseCase,
    private readonly deleteContactUseCase: DeleteContactUseCase,
    private readonly exportContactsUseCase: ExportContactsUseCase,
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des contacts',
    description:
      'Accessible à tous les rôles. Filtres : type, isActive, search ' +
      '(nom société / e-mail / nom du contact). Tri par défaut : nom de ' +
      'société. La pagination est renvoyée dans meta.pagination.',
  })
  @ApiOkResponse({ type: [ContactResponseDto] })
  async list(
    @Query() query: ListContactsQueryDto,
  ): Promise<PaginatedResult<ContactResponseDto>> {
    const result = await this.listContactsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      type: query.type,
      isActive: query.isActive,
    });

    return {
      items: result.items.map(ContactResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get('export')
  @Roles(UserRole.Admin, UserRole.Manager)
  @SkipResponseEnvelope()
  @ApiOperation({
    summary: 'Exporter les contacts (CSV/XLSX)',
    description:
      'Mêmes filtres que la liste, SANS pagination — jusqu’à 10 000 ' +
      'lignes (422 au-delà).',
  })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async export(
    @Query() query: ExportContactsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportContactsUseCase.execute(
      { type: query.type, search: query.search },
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
      `attachment; filename="contacts-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un contact (tous les rôles)" })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiNotFoundResponse({ description: 'Contact inconnu ou supprimé.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ContactResponseDto> {
    const contact = await this.getContactByIdUseCase.execute(id);
    return ContactResponseDto.fromDomain(contact);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Créer un contact' })
  @ApiCreatedResponse({ type: ContactResponseDto })
  @ApiForbiddenResponse({ description: 'Rôle insuffisant (ACCESS_DENIED).' })
  async create(@Body() body: CreateContactDto): Promise<ContactResponseDto> {
    const contact = await this.createContactUseCase.execute(body);
    return ContactResponseDto.fromDomain(contact);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Modifier un contact' })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiNotFoundResponse({ description: 'Contact inconnu ou supprimé.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    const contact = await this.updateContactUseCase.execute(id, body);
    return ContactResponseDto.fromDomain(contact);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un contact (suppression logique)',
    description:
      'Pose deleted_at et is_active = false ; la donnée reste en base. ' +
      'Le blocage « contact lié à des devis/commandes actifs » arrivera ' +
      'avec le module 05.',
  })
  @ApiNoContentResponse({ description: 'Contact supprimé.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteContactUseCase.execute(id);
  }

  @Get(':id/history')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: "Historique d'audit d'un contact" })
  @ApiOkResponse({ type: [AuditLogResponseDto] })
  async history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    const result = await this.listAuditLogsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortDirection: query.sortDirection,
      resourceType: 'contact',
      resourceId: id,
    });

    return {
      items: result.items.map(AuditLogResponseDto.fromDomain),
      meta: result.meta,
    };
  }
}
