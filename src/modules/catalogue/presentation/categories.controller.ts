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
import { CreateCategoryUseCase } from '../application/create-category.use-case';
import { DeleteCategoryUseCase } from '../application/delete-category.use-case';
import { GetCategoryByIdUseCase } from '../application/get-category-by-id.use-case';
import { ListCategoriesUseCase } from '../application/list-categories.use-case';
import { UpdateCategoryUseCase } from '../application/update-category.use-case';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/**
 * Contrôleur des catégories du catalogue.
 * Lecture ouverte à tous les rôles ; écriture ADMIN/MANAGER ;
 * suppression ADMIN.
 */
@ApiTags('Catalogue — Catégories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
    private readonly getCategoryByIdUseCase: GetCategoryByIdUseCase,
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste des catégories (plate, non paginée)',
    description:
      'Renvoie toutes les catégories avec leur parentId : le ' +
      'consommateur reconstitue l’arbre. Filtre optionnel : isActive.',
  })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  async list(
    @Query() query: ListCategoriesQueryDto,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.listCategoriesUseCase.execute({
      isActive: query.isActive,
    });
    return categories.map(CategoryResponseDto.fromDomain);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une catégorie" })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Catégorie inconnue ou supprimée.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CategoryResponseDto> {
    const category = await this.getCategoryByIdUseCase.execute(id);
    return CategoryResponseDto.fromDomain(category);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Créer une catégorie' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiConflictResponse({
    description:
      'Parent déjà sous-catégorie : 1 seul niveau autorisé ' +
      '(BUSINESS_RULE_VIOLATION).',
  })
  async create(@Body() body: CreateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.createCategoryUseCase.execute(body);
    return CategoryResponseDto.fromDomain(category);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Modifier une catégorie' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Catégorie inconnue ou supprimée.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.updateCategoryUseCase.execute(id, body);
    return CategoryResponseDto.fromDomain(category);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une catégorie',
    description:
      'Refusé (409) si la catégorie a des sous-catégories ou des ' +
      'produits rattachés.',
  })
  @ApiNoContentResponse({ description: 'Catégorie supprimée.' })
  @ApiConflictResponse({
    description:
      'Sous-catégories ou produits rattachés (BUSINESS_RULE_VIOLATION).',
  })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.deleteCategoryUseCase.execute(id);
  }
}
