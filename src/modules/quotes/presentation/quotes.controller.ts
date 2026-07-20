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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { OrderResponseDto } from '../../orders/presentation/dto/order-response.dto';
import { AcceptQuoteUseCase } from '../application/accept-quote.use-case';
import { ConvertQuoteToOrderUseCase } from '../application/convert-quote-to-order.use-case';
import { CreateQuoteUseCase } from '../application/create-quote.use-case';
import { DeleteQuoteUseCase } from '../application/delete-quote.use-case';
import { GetQuoteByIdUseCase } from '../application/get-quote-by-id.use-case';
import { ListQuotesUseCase } from '../application/list-quotes.use-case';
import { RejectQuoteUseCase } from '../application/reject-quote.use-case';
import { SendQuoteUseCase } from '../application/send-quote.use-case';
import { UpdateQuoteUseCase } from '../application/update-quote.use-case';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ListQuotesQueryDto } from './dto/list-quotes-query.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

/**
 * Contrôleur des devis.
 * Création ouverte à tous les rôles (un employé prépare un devis) ;
 * modification et transitions ADMIN/MANAGER ; suppression ADMIN.
 */
@ApiTags('Devis')
@ApiBearerAuth()
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly listQuotesUseCase: ListQuotesUseCase,
    private readonly getQuoteByIdUseCase: GetQuoteByIdUseCase,
    private readonly createQuoteUseCase: CreateQuoteUseCase,
    private readonly updateQuoteUseCase: UpdateQuoteUseCase,
    private readonly deleteQuoteUseCase: DeleteQuoteUseCase,
    private readonly sendQuoteUseCase: SendQuoteUseCase,
    private readonly acceptQuoteUseCase: AcceptQuoteUseCase,
    private readonly rejectQuoteUseCase: RejectQuoteUseCase,
    private readonly convertQuoteToOrderUseCase: ConvertQuoteToOrderUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des devis',
    description:
      'Filtres : status, customerId, from/to (date de création, ISO), ' +
      'search (numéro / nom du client). Les lignes ne sont pas incluses.',
  })
  @ApiOkResponse({ type: [QuoteResponseDto] })
  async list(
    @Query() query: ListQuotesQueryDto,
  ): Promise<PaginatedResult<QuoteResponseDto>> {
    const result = await this.listQuotesUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      status: query.status,
      customerId: query.customerId,
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(QuoteResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un devis (avec ses lignes)" })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Devis inconnu.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.getQuoteByIdUseCase.execute(id);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Post()
  @ApiOperation({
    summary: 'Créer un devis (statut DRAFT)',
    description:
      'Numéro auto (DEV-YYYY-NNNN), totaux calculés côté serveur, ' +
      'validité par défaut +30 jours.',
  })
  @ApiCreatedResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Client ou produit inconnu.' })
  @ApiConflictResponse({
    description:
      'Contact non client, produit désactivé ou ligne libre incomplète.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateQuoteDto,
  ): Promise<QuoteResponseDto> {
    const quote = await this.createQuoteUseCase.execute(user, body);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Modifier un devis (DRAFT uniquement)',
    description:
      'Si `lines` est fourni : remplacement complet des lignes et ' +
      'recalcul des totaux.',
  })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Devis inconnu.' })
  @ApiConflictResponse({
    description: 'Devis non modifiable (statut ≠ DRAFT).',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateQuoteDto,
  ): Promise<QuoteResponseDto> {
    const quote = await this.updateQuoteUseCase.execute(id, body);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un devis (DRAFT uniquement)',
    description: 'Suppression physique : un brouillon n’engage personne.',
  })
  @ApiNoContentResponse({ description: 'Devis supprimé.' })
  @ApiConflictResponse({
    description: 'Devis non supprimable (statut ≠ DRAFT).',
  })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteQuoteUseCase.execute(id);
  }

  @Post(':id/send')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoyer un devis (DRAFT → SENT)',
    description:
      'Version minimale : transition de statut seule. PDF et e-mail au ' +
      'client arrivent au niveau min-.',
  })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async send(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.sendQuoteUseCase.execute(id);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Post(':id/accept')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accepter un devis (SENT → ACCEPTED)' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async accept(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.acceptQuoteUseCase.execute(id);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Post(':id/reject')
  @Roles(UserRole.Admin, UserRole.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refuser un devis (SENT → REJECTED)' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiConflictResponse({ description: 'Transition invalide.' })
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.rejectQuoteUseCase.execute(id);
    return QuoteResponseDto.fromDomain(quote);
  }

  @Post(':id/convert')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Convertir un devis accepté en commande client',
    description:
      'Copie les lignes (remise fondue dans le prix unitaire), trace ' +
      'quoteId sur la commande. Un devis ne se convertit qu’une fois.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiConflictResponse({
    description: 'Devis non accepté, ou déjà converti.',
  })
  async convert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderResponseDto> {
    const order = await this.convertQuoteToOrderUseCase.execute(user, id);
    return OrderResponseDto.fromDomain(order);
  }
}
