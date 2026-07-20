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
  ApiForbiddenResponse,
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
import { ChangeMyPasswordUseCase } from '../application/change-my-password.use-case';
import { ChangeUserRoleUseCase } from '../application/change-user-role.use-case';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { DeactivateUserUseCase } from '../application/deactivate-user.use-case';
import { GetUserByIdUseCase } from '../application/get-user-by-id.use-case';
import { ListUsersUseCase } from '../application/list-users.use-case';
import { ReactivateUserUseCase } from '../application/reactivate-user.use-case';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Contrôleur d'administration des utilisateurs.
 *
 * Volontairement mince : chaque handler délègue à un cas d'utilisation.
 * Les accès sont gouvernés par @Roles (évalué par le RolesGuard global) ;
 * l'authentification est déjà exigée par le guard JWT global.
 *
 * ⚠️ Ordre des routes : les routes /users/me et /users/me/password
 * DOIVENT être déclarées avant /users/:id, sinon Express résout "me"
 * comme un :id (et ParseUUIDPipe répond 400).
 */
@ApiTags('Utilisateurs')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly changeUserRoleUseCase: ChangeUserRoleUseCase,
    private readonly changeMyPasswordUseCase: ChangeMyPasswordUseCase,
    private readonly deactivateUserUseCase: DeactivateUserUseCase,
    private readonly reactivateUserUseCase: ReactivateUserUseCase,
  ) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Liste paginée des utilisateurs',
    description:
      'Filtres : role, isActive, search (e-mail / nom affiché). ' +
      'La pagination est renvoyée dans meta.pagination.',
  })
  @ApiOkResponse({ type: [UserResponseDto] })
  @ApiForbiddenResponse({ description: 'Rôle insuffisant (ACCESS_DENIED).' })
  async list(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const result = await this.listUsersUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      role: query.role,
      isActive: query.isActive,
    });

    return {
      items: result.items.map(UserResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get('me')
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  @ApiOkResponse({ type: UserResponseDto })
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const profile = await this.getUserByIdUseCase.execute(user.userId);
    return UserResponseDto.fromDomain(profile);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Changer son propre mot de passe',
    description:
      "Exige le mot de passe actuel. Ne concerne QUE l'utilisateur " +
      'connecté : un admin ne change jamais le mot de passe des autres.',
  })
  @ApiNoContentResponse({ description: 'Mot de passe changé.' })
  @ApiConflictResponse({
    description:
      'Mot de passe actuel incorrect, ou compte sans mot de passe local ' +
      '(BUSINESS_RULE_VIOLATION).',
  })
  async changeMyPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangeMyPasswordDto,
  ): Promise<void> {
    await this.changeMyPasswordUseCase.execute(
      user,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Get(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: "Détail d'un utilisateur" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur inconnu ou supprimé.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.getUserByIdUseCase.execute(id);
    return UserResponseDto.fromDomain(user);
  }

  @Post()
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Créer un utilisateur (rôle EMPLOYEE par défaut)' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({
    description: 'E-mail déjà utilisé (RESOURCE_ALREADY_EXISTS).',
  })
  async create(@Body() body: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.createUserUseCase.execute({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      role: body.role,
    });
    return UserResponseDto.fromDomain(user);
  }

  @Patch(':id/role')
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: "Changer le rôle d'un utilisateur",
    description:
      'Impossible sur soi-même, et impossible de rétrograder le dernier ' +
      'ADMIN actif.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur inconnu ou supprimé.' })
  @ApiConflictResponse({
    description:
      'Propre rôle ou dernier ADMIN actif (BUSINESS_RULE_VIOLATION).',
  })
  async changeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ChangeRoleDto,
  ): Promise<UserResponseDto> {
    const updated = await this.changeUserRoleUseCase.execute(
      user,
      id,
      body.role,
    );
    return UserResponseDto.fromDomain(updated);
  }

  @Patch(':id/reactivate')
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'Réactiver un utilisateur désactivé',
    description:
      'Efface deleted_at et remet is_active = true. Idempotent : ' +
      'réactiver un compte déjà actif renvoie simplement son état.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur inconnu.' })
  async reactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.reactivateUserUseCase.execute(id);
    return UserResponseDto.fromDomain(user);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Désactiver un utilisateur (suppression logique)',
    description:
      'Pose deleted_at et is_active = false. Impossible sur soi-même.',
  })
  @ApiNoContentResponse({ description: 'Utilisateur désactivé.' })
  @ApiConflictResponse({
    description: 'Auto-désactivation (BUSINESS_RULE_VIOLATION).',
  })
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.deactivateUserUseCase.execute(user, id);
  }
}
