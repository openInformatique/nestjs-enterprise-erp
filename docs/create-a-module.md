# Créer un nouveau module

Guide pas à pas pour ajouter un module respectant l'architecture du socle.
Exemple fil rouge : un module `projects` gérant des « projets » (exemple
pédagogique — le socle lui-même ne contient aucune logique métier).

## 1. Arborescence

```text
src/modules/projects/
├── domain/
│   ├── project.ts                        # Modèle de domaine (classe pure)
│   └── project-repository.port.ts        # Contrat de persistance + jeton
├── application/
│   ├── create-project.use-case.ts
│   └── list-projects.use-case.ts
├── infrastructure/
│   ├── entities/project.entity.ts        # Entité TypeORM
│   ├── project.mapper.ts                 # Entité <-> domaine
│   └── typeorm-project.repository.ts     # Implémentation du port
├── presentation/
│   ├── dto/create-project-request.dto.ts
│   ├── dto/project-response.dto.ts
│   └── projects.controller.ts
└── projects.module.ts
```

Règles : le domaine n'importe RIEN de NestJS/TypeORM/Express ; le contrôleur
n'utilise JAMAIS un repository directement ; l'infrastructure implémente les
contrats du domaine.

## 2. Domaine

```typescript
// domain/project.ts — aucune dépendance framework
export class Project {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly createdAt: Date,
  ) {}
}

// domain/project-repository.port.ts
import { Project } from './project';

export interface ProjectRepositoryPort {
  findById(id: string): Promise<Project | null>;
  save(name: string): Promise<Project>;
}

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');
```

## 3. Entité TypeORM (infrastructure)

```typescript
// infrastructure/entities/project.entity.ts
import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';

/** Table `projects` : hérite id UUID, dates, soft delete, created_by/updated_by. */
@Entity({ name: 'projects' })
export class ProjectEntity extends AuditableEntity {
  @Column({ name: 'name', type: 'nvarchar', length: 200 })
  name!: string;
}
```

Le glob du DataSource CLI (`src/modules/**/infrastructure/**/*.entity.ts`)
détecte automatiquement la nouvelle entité.

## 4. Migration

```bash
npm run migration:generate -- src/database/migrations/CreateProjectsTable
# Relire le SQL généré, puis :
npm run migration:run
npm run migration:run:test
```

`synchronize` est désactivé définitivement : TOUTE évolution de schéma passe
par une migration versionnée.

## 5. Repository et mapper (infrastructure)

```typescript
// infrastructure/typeorm-project.repository.ts
@Injectable()
export class TypeOrmProjectRepository implements ProjectRepositoryPort {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly repository: Repository<ProjectEntity>,
    private readonly mapper: ProjectMapper,
  ) {}
  // ... findById / save : convertir via mapper.toDomain(entity)
}
```

## 6. Cas d'utilisation (application)

```typescript
@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
    private readonly auditService: AuditService, // audit explicite
  ) {}

  async execute(name: string, userId: string): Promise<Project> {
    const project = await this.projects.save(name);
    // Audit déclaré PAR le cas d'utilisation, avec un contexte maîtrisé.
    await this.auditService.record({
      category: AuditCategory.Business,
      action: 'project.created',
      actorUserId: userId,
      resourceType: 'project',
      resourceId: project.id,
    });
    return project;
  }
}
```

## 7. DTO et contrôleur (presentation)

```typescript
export class CreateProjectRequestDto {
  @ApiProperty({ example: 'Refonte intranet' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du projet est requis.' })
  @MaxLength(200)
  name!: string;
}

@ApiTags('Projets')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly createProject: CreateProjectUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Créer un projet' })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  async create(
    @Body() body: CreateProjectRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectResponseDto> {
    const project = await this.createProject.execute(body.name, user.userId);
    return { id: project.id, name: project.name };
  }
}
```

Le guard JWT global protège la route automatiquement (pas de `@Public()`).
L'enveloppe standardisée s'applique automatiquement à la réponse.

## 8. Liste paginée avec les helpers du socle

```typescript
// application/list-projects.use-case.ts — colonnes autorisées en liste blanche
const SORTABLE_COLUMNS: ColumnWhitelist = {
  name: 'project.name',
  createdAt: 'project.created_at',
};
const SEARCHABLE_COLUMNS = ['project.name'] as const;

async execute(query: PaginationQueryDto): Promise<PaginatedResult<ProjectEntity>> {
  const qb = this.repository.createQueryBuilder('project');
  TypeOrmFilterHelper.applySearch(qb, query.search, SEARCHABLE_COLUMNS);
  TypeOrmFilterHelper.applySort(qb, query.sortBy, query.sortDirection, SORTABLE_COLUMNS);
  return TypeOrmPaginationHelper.paginate(qb, query.page, query.limit);
}
```

Le contrôleur reçoit `@Query() query: PaginationQueryDto` (ou une classe qui
l'étend) et renvoie le résultat tel quel : l'interceptor d'enveloppe détecte
le résultat paginé et produit `meta.pagination` automatiquement.

## 9. Déclaration du module

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity]), AuditModule],
  controllers: [ProjectsController],
  providers: [
    ProjectMapper,
    CreateProjectUseCase,
    ListProjectsUseCase,
    { provide: PROJECT_REPOSITORY, useClass: TypeOrmProjectRepository },
  ],
})
export class ProjectsModule {}
```

Puis ajouter `ProjectsModule` aux imports d'`AppModule`.

## 10. Tests

- **Unitaires** (`*.spec.ts` à côté des fichiers) : cas d'utilisation avec
  ports mockés, mappers, DTO (`plainToInstance` + `validateSync`) ;
- **Intégration** (`test/integration/*.integration-spec.ts`) : repository
  contre la base de test réelle (voir `createTestDataSource()`) ;
- **E2e** (`test/e2e/*.e2e-spec.ts`) : parcours HTTP complet via
  `createE2eApplication()`.

## Checklist finale

- [ ] Domaine sans dépendance framework
- [ ] Contrôleur léger, aucun repository TypeORM injecté
- [ ] Migration créée ET exécutée (locale + test)
- [ ] Tri/filtres uniquement via listes blanches
- [ ] Audit explicite dans les cas d'utilisation significatifs
- [ ] Swagger complet (ApiOperation, réponses, erreurs)
- [ ] Tests unitaires + intégration + e2e
- [ ] `npm run build && npm run lint && npm test` au vert
