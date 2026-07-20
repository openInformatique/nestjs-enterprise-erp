# mini-DEV-10 · Transversal — Recherche, Exports & Historique — l'essentiel pour démarrer

> **Spec couverte** : `specs/10-transversal-recherche-exports-historique/10-transversal-recherche-exports-historique.md` (version minimale)
> **Niveau** : 🟢 fonctionnel — même logique que les `mini-DEV-01` à `09` (voir `RECAP-DEV-01` pour la philosophie des 3 niveaux).
> **Prérequis** : `mini-DEV-01` à `mini-DEV-09` terminés. Ce module ne crée presque aucune table : il **transperce** les modules existants (contacts, catalogue, commandes, factures, paiements, audit) pour leur ajouter trois capacités transverses.
> **Promesse** : à la fin, la pagination/filtres posés dès le module 02 sont CONFIRMÉS partout ; une recherche globale interroge quatre modules d'un clic ; cinq modules savent s'exporter en CSV/XLSX ; et le journal d'audit — jusqu'ici muet, sans le moindre endpoint — s'expose enfin, avec un historique par ressource. 12 routes dans Swagger. Environ 3 h 30.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — Pagination & filtres (déjà en place)](#étape-1--pagination--filtres-déjà-en-place)
- [Étape 2 — Le helper d'export (CSV/XLSX) et son garde-fou](#étape-2--le-helper-dexport-csvxlsx-et-son-garde-fou)
- [Étape 3 — Les exports, module par module](#étape-3--les-exports-module-par-module)
- [Étape 4 — La recherche globale](#étape-4--la-recherche-globale)
- [Étape 5 — Exposer l'audit et l'historique par ressource](#étape-5--exposer-laudit-et-lhistorique-par-ressource)
- [Étape 6 — Le module + AppModule](#étape-6--le-module--appmodule)
- [Étape 7 — Vérifier que ça marche & ce qu'on verra plus tard](#étape-7--vérifier-que-ça-marche--ce-quon-verra-plus-tard)

---

## 0 · Avant de commencer

- API démarrée, base à jour, tous les modules 02 à 09 appliqués.
- Pour les rappels sur le socle : section A de `mini-DEV-01`.
- **Lis en entier le § 0.1 ci-dessous avant de commencer l'étape 5** : l'historique par ressource a une limite réelle qu'il faut connaître, pas découvrir en testant.

### Les nouveautés de ce module

1. **Le module qui ne crée rien, ou presque.** Pas de nouvelle table pour la pagination (déjà là), pas de nouvelle table pour les exports (ils LISENT), pas de nouvelle table pour l'audit (`audit_logs` existe depuis le socle). Seule vraie création : le petit module `search`, sans état. La leçon : « transversal » ne veut pas dire « gros », ça veut dire « qui traverse ».
2. **Deux façons de lire à travers les modules — et QUAND choisir laquelle.** Le module 09 (dashboard) est descendu au SQL brut parce qu'aucun repository ne sait faire un `SUM`/`GROUP BY`/`TOP N par CA`. La recherche globale, elle, RÉUTILISE les repositories existants (`ContactRepositoryPort.findAll({ search, limit: 5 })`, etc.) : chaque module sait DÉJÀ chercher par texte (`TypeOrmFilterHelper.applySearch`, posé au module 02) — inutile de le réécrire en SQL. Le bon outil dépend de la question, pas de l'habitude.
3. **Les téléchargements binaires.** Après les fichiers et le PDF de démonstration (socle), troisième et quatrième usages de `StreamableFile` + `@SkipResponseEnvelope()` — mais cette fois construits par le code applicatif lui-même (CSV/XLSX), pas lus depuis un stockage.
4. **Encore l'ordre des routes.** `GET /contacts/export` DOIT être déclaré AVANT `GET /contacts/:id` dans chaque contrôleur — exactement le piège du module 08 (`/payments/overdue` avant `/payments/:id`), qui revient ici FOIS CINQ.
5. **Le journal qui attendait son lecteur.** `AuditLogRepositoryPort` ne savait qu'`insert()` depuis le socle (étape 15) : ce module lui ajoute `findAll()` — la première fois qu'on lit ce qu'on a écrit sans discontinuer depuis six modules.

### 0.1 · Ce que l'historique par ressource peut — et ne peut PAS — montrer

**Lis ceci avant de tester l'étape 5, pas après.** L'historique (`GET /contacts/:id/history`, etc.) n'est qu'une LECTURE filtrée d'`audit_logs` — il ne peut montrer que ce qui a été ÉCRIT. Or, à ce jour :

- `AuditService.log(...)` n'est appelé QUE par le socle : `authentication` (login, logout, révocation de session) et les endpoints de démonstration (mail, PDF, storage).
- **Aucun** use case métier des modules 02 à 08 (créer/modifier/supprimer un contact, un produit, un devis, une commande, une facture, un paiement) n'appelle `AuditService.log(...)` — chaque guide l'a noté explicitement en « 🟡 min- » (« `createdBy` trace déjà l'auteur ; le journal central est un plus »).

**Conséquence assumée** : ce module expose fidèlement le journal, mais `GET /contacts/:id/history` renverra une liste VIDE tant qu'aucune écriture n'a été instrumentée pour les contacts. Ce n'est pas un bug de ce guide — c'est la dette explicitement différée depuis le module 02, qui reste à honorer module par module (voir § 7.3). Rien n'est cassé : la lecture fonctionne, l'écriture manque encore.

---

## B · Ce qu'on va construire

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/search` | tout connecté | Recherche globale (contacts, produits, commandes, factures), 5 résultats max par type |
| `GET /api/v1/contacts/export` | ADMIN, MANAGER | Export CSV/XLSX des contacts (filtres habituels, sans pagination) |
| `GET /api/v1/contacts/:id/history` | ADMIN, MANAGER | Historique d'audit d'un contact |
| `GET /api/v1/products/export` | ADMIN, MANAGER | Export CSV/XLSX des produits |
| `GET /api/v1/products/:id/history` | ADMIN, MANAGER | Historique d'audit d'un produit |
| `GET /api/v1/orders/export` | ADMIN, MANAGER | Export CSV/XLSX des commandes |
| `GET /api/v1/orders/:id/history` | tout connecté | Historique d'audit d'une commande |
| `GET /api/v1/invoices/export` | ADMIN, MANAGER | Export CSV/XLSX des factures et avoirs |
| `GET /api/v1/invoices/:id/history` | tout connecté | Historique d'audit d'une facture |
| `GET /api/v1/payments/export` | ADMIN, MANAGER | Export CSV/XLSX des paiements |
| `GET /api/v1/payments/:id/history` | ADMIN, MANAGER | Historique d'audit d'un paiement |
| `GET /api/v1/audit-logs` | ADMIN | Le journal complet, filtrable |

**Les règles métier incluses** :

- exports : SANS pagination (toutes les lignes matchant les filtres), plafonnés à 10 000 lignes — au-delà, **422** plutôt qu'un export tronqué silencieusement ;
- export CSV : UTF-8 avec BOM (Excel affiche correctement les accents sans ça) ;
- recherche globale : `q` minimum 2 caractères (validé par le DTO, donc 400 automatique en dessous) ; 5 résultats par type, 20 au total ; `types` filtre les catégories cherchées ;
- audit logs : lecture seule — aucun endpoint de modification n'existe, n'existera jamais (c'est un journal) ;
- l'ordre des routes dans chaque contrôleur : `export` (statique) AVANT `:id` (paramétrée) — sinon 400 UUID garanti.

**25 fichiers créés, 16 modifiés** (2 fichiers d'exceptions communes, le port + l'implémentation + le module du journal d'audit, `app.module.ts`, et 5 × [contrôleur + module] pour les exports/historiques). **0 migration**.

---

## Étape 1 — Pagination & filtres (déjà en place)

> ⚠️ La spec réelle demande d'implémenter ceci **avant le module 02**. Comme tous les guides précédents ont suivi ce conseil dès le départ, il n'y a RIEN à créer ici — cette étape CONFIRME ce qui existe déjà.

Le socle porte déjà tout l'outillage transversal de pagination, posé au fil des modules 02 à 09 :

| Pièce | Fichier | Depuis |
|---|---|---|
| Query commune (page, limit, sortBy, sortDirection, search) | `src/common/pagination/pagination-query.dto.ts` | module 02 |
| Plage de dates réutilisable (`from`/`to`) | `src/common/pagination/date-range.dto.ts` | module 04 |
| Résultat paginé (`items` + `meta`) | `src/common/pagination/paginated-result.ts` | module 02 |
| Métadonnées (page, limit, totalItems, totalPages…) | `src/common/pagination/pagination-meta.dto.ts` | module 02 |
| Tri + recherche sécurisés (liste blanche de colonnes) | `src/common/pagination/typeorm-filter.helper.ts` | module 02 |
| Application du skip/take | `src/common/pagination/typeorm-pagination.helper.ts` | module 02 |

**Vérifie** que chaque endpoint de liste retourne bien un `PaginatedResult<T>` (l'interceptor d'enveloppe le détecte automatiquement — `meta.pagination` dans la réponse) :

- [x] `GET /contacts` (module 02)
- [x] `GET /products` (module 03)
- [x] `GET /stock` et `GET /stock/movements` (module 04)
- [x] `GET /quotes` (module 05)
- [x] `GET /orders` (module 06)
- [x] `GET /invoices` (module 07)
- [x] `GET /payments` (module 08)

Rien à coder : c'est le paragraphe qui dit « vous l'avez déjà fait, en avançant module par module plutôt qu'en accumulant tout au début ». C'est aussi pour ça que le fichier générique `PaginatedResponseDto<T>` de la spec brute n'existe pas ici : `PaginatedResult<T>` (l'interface, pas une classe DTO) le remplace depuis le module 02, et c'est LUI que tous les guides ont utilisé.

**✅ Point de contrôle** : relance `GET /contacts?page=1&limit=5` — la réponse contient `meta.pagination.totalItems`.

---

## Étape 2 — Le helper d'export (CSV/XLSX) et son garde-fou

### ➕ Installer la dépendance

```bash
npm install exceljs
```

### ➕ Créer `src/common/enums/export-format.enum.ts`

```typescript
/** Format demandé pour un export (query string `?format=`). */
export enum ExportFormat {
  Csv = 'csv',
  Xlsx = 'xlsx',
}
```

### ➕ Créer `src/common/utils/export.constants.ts`

```typescript
/**
 * Plafond de lignes d'un export. Au-delà, on refuse (422) plutôt que
 * de tronquer silencieusement — un export tronqué sans le dire est
 * un mensonge comptable.
 */
export const EXPORT_MAX_ROWS = 10_000;
```

### ➕ Créer `src/common/utils/export.helper.ts`

Une seule construction de lignes (`rows: unknown[][]`, types natifs — `Date`, `number`, `boolean`) sert AUX DEUX formats : `toCSV` stringifie au moment d'écrire, `toXLSX` garde les types natifs (Excel sait sommer une colonne de nombres, formater une date).

```typescript
import ExcelJS from 'exceljs';

/** BOM UTF-8 : sans lui, Excel affiche les accents comme du charabia. */
const UTF8_BOM = '﻿';

/** Convertit une valeur de cellule en texte CSV sûr. */
function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

/** Échappe un champ CSV : guillemets doublés si virgule, guillemet ou saut de ligne. */
function escapeCsvField(raw: string): string {
  if (/[",\n;]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Construction de fichiers d'export — aucune dépendance à un module métier. */
export class ExportHelper {
  /** CSV UTF-8 avec BOM (compatibilité Excel), séparateur virgule. */
  static toCSV(headers: string[], rows: unknown[][]): Buffer {
    const lines = [headers, ...rows].map((row) =>
      row.map((cell) => escapeCsvField(formatCsvCell(cell))).join(','),
    );
    return Buffer.from(UTF8_BOM + lines.join('\r\n'), 'utf-8');
  }

  /** Classeur XLSX à une feuille, en-tête en gras. */
  static async toXLSX(
    sheetName: string,
    headers: string[],
    rows: unknown[][],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow(headers);
    for (const row of rows) {
      sheet.addRow(row);
    }
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
```

### ✏️ Modifier `src/common/exceptions/error-code.enum.ts`

Ajoute une entrée, après `BusinessRuleViolation` :

```typescript
  ExportTooLarge = 'EXPORT_TOO_LARGE',
```

### ✏️ Modifier `src/common/exceptions/app-exceptions.ts`

Ajoute la classe, à la fin du fichier :

```typescript
/**
 * L'export dépasse le plafond de lignes (10 000). 422 : la requête est
 * bien formée, mais le VOLUME de données qu'elle désigne est trop
 * grand pour être traité — distinct d'une erreur de validation (400)
 * ou d'une règle métier violée (409).
 */
export class ExportTooLargeException extends AppException {
  constructor(actualCount: number, maxRows: number) {
    super(
      ErrorCode.ExportTooLarge,
      `L'export contient ${actualCount} lignes, au-delà du plafond de ` +
        `${maxRows}. Affinez les filtres pour réduire le volume.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 3 — Les exports, module par module

Même patron RÉPÉTÉ cinq fois : un use case appelle le `findAll` du module (page 1, limite `EXPORT_MAX_ROWS + 1`, filtres sans pagination), vérifie le total, construit les lignes, délègue à `ExportHelper`. Le contrôleur ajoute UNE route `GET /export`, **déclarée avant `GET :id`**.

### 3.1 · Contacts

#### ➕ Créer `src/modules/contact/presentation/dto/export-contacts-query.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ExportFormat } from '../../../../common/enums/export-format.enum';
import { ContactType } from '../../domain/contact-type.enum';

/** Query de GET /contacts/export — les filtres habituels, SANS pagination. */
export class ExportContactsQueryDto {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional({ enum: ContactType })
  @IsOptional()
  @IsEnum(ContactType, {
    message: 'Le type doit valoir CUSTOMER, SUPPLIER ou BOTH.',
  })
  type?: ContactType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
```

#### ➕ Créer `src/modules/contact/application/export-contacts.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type { ContactRepositoryPort } from '../domain/contact-repository.port';
import { ContactType } from '../domain/contact-type.enum';

/** Filtres d'export (les mêmes que la liste, sans pagination ni tri). */
export interface ExportContactsFilters {
  type?: ContactType;
  search?: string;
}

const HEADERS = [
  'Type',
  'Société',
  'Contact',
  'E-mail',
  'Téléphone',
  'Ville',
  'Pays',
  'SIRET',
  'TVA intracommunautaire',
  'Actif',
];

/** Cas d'utilisation : exporter les contacts (CSV/XLSX), filtres appliqués. */
@Injectable()
export class ExportContactsUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  async execute(
    filters: ExportContactsFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const result = await this.contactRepository.findAll({
      page: 1,
      limit: EXPORT_MAX_ROWS + 1,
      sortDirection: SortDirection.Asc,
      type: filters.type,
      search: filters.search,
    });

    if (result.meta.totalItems > EXPORT_MAX_ROWS) {
      throw new ExportTooLargeException(
        result.meta.totalItems,
        EXPORT_MAX_ROWS,
      );
    }

    const rows = result.items.map((contact) => [
      contact.type,
      contact.companyName,
      contact.contactName ?? '',
      contact.email ?? '',
      contact.phone ?? '',
      contact.city ?? '',
      contact.country,
      contact.siret ?? '',
      contact.vatNumber ?? '',
      contact.isActive ? 'Oui' : 'Non',
    ]);

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Contacts', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
```

#### ✏️ Modifier `src/modules/contact/presentation/contacts.controller.ts`

**1)** Ajoute les imports :

```typescript
import { Res } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { ApiProduces } from '@nestjs/swagger';
import { SkipResponseEnvelope } from '../../../common/decorators/skip-response-envelope.decorator';
import { ExportContactsUseCase } from '../application/export-contacts.use-case';
import { ExportContactsQueryDto } from './dto/export-contacts-query.dto';
```

(regroupe-les naturellement avec les imports existants de `@nestjs/common` et `@nestjs/swagger` plutôt que de dupliquer les lignes d'import.)

**2)** Ajoute le use case au constructeur :

```typescript
    private readonly exportContactsUseCase: ExportContactsUseCase,
```

**3)** Ajoute la route **JUSTE APRÈS `@Get()` (list) et AVANT `@Get(':id')`** — l'ordre est ce qui rend `export` reconnaissable comme un segment fixe, pas un UUID :

```typescript
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
      query.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="contacts-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }
```

> ⚠️ **`@Get('export')` avant `@Get(':id')`** dans le fichier — sinon Nest capte `/contacts/export` comme `/contacts/:id` et le `ParseUUIDPipe` renvoie 400. Exactement le piège `overdue`/`:id` du module 08.

#### ✏️ Modifier `src/modules/contact/contacts.module.ts`

Ajoute `ExportContactsUseCase` au tableau `providers` :

```typescript
    ExportContactsUseCase,
```

**✅ Point de contrôle** : `npm run build`

---

### 3.2 · Produits

Même patron ; seule nouveauté : le nom de la CATÉGORIE n'est pas porté par `Product` (qui n'a que `categoryId`). Plutôt qu'une requête par ligne (jusqu'à 10 000 allers-retours), on charge TOUTES les catégories UNE fois (`ListCategoriesUseCase`, déjà sans pagination — module 03) et on résout via une `Map` en mémoire.

#### ➕ Créer `src/modules/catalogue/presentation/dto/export-products-query.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ExportFormat } from '../../../../common/enums/export-format.enum';
import { ProductType } from '../../domain/product-type.enum';

/** Query de GET /products/export — les filtres habituels, SANS pagination. */
export class ExportProductsQueryDto {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType, { message: 'Le type doit valoir PRODUCT ou SERVICE.' })
  type?: ProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: 'Le categoryId doit être un UUID valide.' })
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
```

#### ➕ Créer `src/modules/catalogue/application/export-products.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.port';
import type { ProductRepositoryPort } from '../domain/product-repository.port';
import { ProductType } from '../domain/product-type.enum';
import { ListCategoriesUseCase } from './list-categories.use-case';

/** Filtres d'export. */
export interface ExportProductsFilters {
  type?: ProductType;
  categoryId?: string;
  search?: string;
}

const HEADERS = [
  'SKU',
  'Nom',
  'Type',
  'Catégorie',
  'Prix de vente HT',
  "Prix d'achat HT",
  'TVA (%)',
  'Unité',
  'Actif',
];

/** Cas d'utilisation : exporter le catalogue (CSV/XLSX), filtres appliqués. */
@Injectable()
export class ExportProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
  ) {}

  async execute(
    filters: ExportProductsFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const [result, categories] = await Promise.all([
      this.productRepository.findAll({
        page: 1,
        limit: EXPORT_MAX_ROWS + 1,
        sortDirection: SortDirection.Asc,
        type: filters.type,
        categoryId: filters.categoryId,
        search: filters.search,
      }),
      // Chargée UNE fois (liste plate, module 03) : résout categoryId ->
      // nom sans requête par ligne, même sur 10 000 produits.
      this.listCategoriesUseCase.execute({}),
    ]);

    if (result.meta.totalItems > EXPORT_MAX_ROWS) {
      throw new ExportTooLargeException(
        result.meta.totalItems,
        EXPORT_MAX_ROWS,
      );
    }

    const categoryNames = new Map(
      categories.map((category) => [category.id, category.name]),
    );

    const rows = result.items.map((product) => [
      product.sku,
      product.name,
      product.type,
      product.categoryId ? (categoryNames.get(product.categoryId) ?? '') : '',
      product.unitPrice,
      product.purchasePrice ?? '',
      product.vatRate,
      product.unit,
      product.isActive ? 'Oui' : 'Non',
    ]);

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Produits', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
```

#### ✏️ Modifier `src/modules/catalogue/presentation/products.controller.ts`

Même trois retouches qu'à `ContactsController` : imports (`Res`, `StreamableFile`, `Response`, `ApiProduces`, `SkipResponseEnvelope`, `ExportProductsUseCase`, `ExportProductsQueryDto`), le use case au constructeur, la route — **avant `@Get(':id')`** :

```typescript
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
      { type: query.type, categoryId: query.categoryId, search: query.search },
      query.format,
    );

    const date = new Date().toISOString().slice(0, 10);
    response.setHeader(
      'Content-Type',
      query.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="produits-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }
```

#### ✏️ Modifier `src/modules/catalogue/catalogue.module.ts`

Ajoute `ExportProductsUseCase` aux `providers`.

**✅ Point de contrôle** : `npm run build`

---

### 3.3 · Commandes

`Order` porte déjà `contactName` dénormalisé (module 06) : pas de jointure supplémentaire.

#### ➕ Créer `src/modules/orders/presentation/dto/export-orders-query.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { ExportFormat } from '../../../../common/enums/export-format.enum';
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';

/** Query de GET /orders/export — les filtres habituels, SANS pagination. */
export class ExportOrdersQueryDto extends IntersectionType(DateRangeDto) {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional({ enum: OrderType })
  @IsOptional()
  @IsEnum(OrderType, { message: 'Le type doit valoir CUSTOMER ou SUPPLIER.' })
  type?: OrderType;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus, {
    message:
      'Le statut doit valoir DRAFT, CONFIRMED, IN_PROGRESS, DELIVERED ou CANCELLED.',
  })
  status?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: 'Le contactId doit être un UUID valide.' })
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
```

> 💡 `IntersectionType(DateRangeDto)` à un seul argument peut surprendre : c'est simplement pour rester dans le même IDIOME que les DTOs de liste (`IntersectionType(PaginationQueryDto, DateRangeDto)`), en ne gardant QUE la brique dont un export a besoin. Une simple `extends DateRangeDto` fonctionne identiquement si tu préfères la lisibilité directe.

#### ➕ Créer `src/modules/orders/application/export-orders.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { ORDER_REPOSITORY } from '../domain/order-repository.port';
import type { OrderRepositoryPort } from '../domain/order-repository.port';
import { OrderStatus } from '../domain/order-status.enum';
import { OrderType } from '../domain/order-type.enum';

/** Filtres d'export. */
export interface ExportOrdersFilters {
  type?: OrderType;
  status?: OrderStatus;
  contactId?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

const HEADERS = [
  'Numéro',
  'Type',
  'Statut',
  'Contact',
  'Total HT',
  'Total TTC',
  'Livraison prévue',
  'Livrée le',
  'Créée le',
];

/** Cas d'utilisation : exporter les commandes (CSV/XLSX), filtres appliqués. */
@Injectable()
export class ExportOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  async execute(
    filters: ExportOrdersFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const result = await this.orderRepository.findAll({
      page: 1,
      limit: EXPORT_MAX_ROWS + 1,
      sortDirection: SortDirection.Asc,
      type: filters.type,
      status: filters.status,
      contactId: filters.contactId,
      search: filters.search,
      from: filters.from,
      to: filters.to,
    });

    if (result.meta.totalItems > EXPORT_MAX_ROWS) {
      throw new ExportTooLargeException(
        result.meta.totalItems,
        EXPORT_MAX_ROWS,
      );
    }

    const rows = result.items.map((order) => [
      order.number,
      order.type,
      order.status,
      order.contactName,
      order.totalHT,
      order.totalTTC,
      order.expectedDeliveryDate ?? '',
      order.deliveredAt ?? '',
      order.createdAt,
    ]);

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Commandes', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
```

#### ✏️ Modifier `src/modules/orders/presentation/orders.controller.ts`

Mêmes retouches (imports, use case au constructeur), route **avant `@Get(':id')`** :

```typescript
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
      query.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="commandes-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }
```

#### ✏️ Modifier `src/modules/orders/orders.module.ts`

Ajoute `ExportOrdersUseCase` aux `providers`.

**✅ Point de contrôle** : `npm run build`

---

### 3.4 · Factures & avoirs

`Invoice.remainingAmount()` (module 07) donne le reste à payer sans recalcul manuel.

#### ➕ Créer `src/modules/invoices/presentation/dto/export-invoices-query.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { ExportFormat } from '../../../../common/enums/export-format.enum';
import { InvoiceStatus } from '../../domain/invoice-status.enum';
import { InvoiceType } from '../../domain/invoice-type.enum';

/** Query de GET /invoices/export — les filtres habituels, SANS pagination. */
export class ExportInvoicesQueryDto extends IntersectionType(DateRangeDto) {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional({ enum: InvoiceType })
  @IsOptional()
  @IsEnum(InvoiceType, { message: 'Le type doit valoir INVOICE ou CREDIT_NOTE.' })
  type?: InvoiceType;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus, {
    message:
      'Le statut doit valoir DRAFT, SENT, PARTIALLY_PAID, PAID, OVERDUE ou CANCELLED.',
  })
  status?: InvoiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: 'Le customerId doit être un UUID valide.' })
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
```

#### ➕ Créer `src/modules/invoices/application/export-invoices.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { INVOICE_REPOSITORY } from '../domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../domain/invoice-repository.port';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import { InvoiceType } from '../domain/invoice-type.enum';

/** Filtres d'export. */
export interface ExportInvoicesFilters {
  type?: InvoiceType;
  status?: InvoiceStatus;
  customerId?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

const HEADERS = [
  'Numéro',
  'Type',
  'Statut',
  'Client',
  "Date d'émission",
  "Date d'échéance",
  'Total HT',
  'Total TTC',
  'Payé',
  'Reste à payer',
];

/** Cas d'utilisation : exporter factures et avoirs (CSV/XLSX). */
@Injectable()
export class ExportInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
  ) {}

  async execute(
    filters: ExportInvoicesFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const result = await this.invoiceRepository.findAll({
      page: 1,
      limit: EXPORT_MAX_ROWS + 1,
      sortDirection: SortDirection.Asc,
      type: filters.type,
      status: filters.status,
      customerId: filters.customerId,
      search: filters.search,
      from: filters.from,
      to: filters.to,
    });

    if (result.meta.totalItems > EXPORT_MAX_ROWS) {
      throw new ExportTooLargeException(
        result.meta.totalItems,
        EXPORT_MAX_ROWS,
      );
    }

    const rows = result.items.map((invoice) => [
      invoice.number,
      invoice.type,
      invoice.status,
      invoice.customerName,
      invoice.issueDate,
      invoice.dueDate,
      invoice.totalHT,
      invoice.totalTTC,
      invoice.paidAmount,
      invoice.remainingAmount(),
    ]);

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Factures', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
```

#### ✏️ Modifier `src/modules/invoices/presentation/invoices.controller.ts`

Mêmes retouches, route **avant `@Get(':id')`** :

```typescript
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
      query.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="factures-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }
```

#### ✏️ Modifier `src/modules/invoices/invoices.module.ts`

Ajoute `ExportInvoicesUseCase` aux `providers`.

**✅ Point de contrôle** : `npm run build`

---

### 3.5 · Paiements

`Payment` (module 08) ne porte NI le numéro de facture NI le nom du client — seulement `invoiceId`. Plutôt qu'une requête par paiement (jusqu'à 10 000 relectures de facture), on DÉDUPLIQUE les `invoiceId` et on ne relit chaque facture concernée qu'UNE fois : en pratique, un export de paiements porte sur BEAUCOUP moins de factures distinctes que de paiements (plusieurs acomptes par facture).

#### ➕ Créer `src/modules/payments/presentation/dto/export-payments-query.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { ExportFormat } from '../../../../common/enums/export-format.enum';
import { PaymentMethod } from '../../domain/payment-method.enum';

/** Query de GET /payments/export — les filtres habituels, SANS pagination. */
export class ExportPaymentsQueryDto extends IntersectionType(DateRangeDto) {
  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat, { message: 'Le format doit valoir "csv" ou "xlsx".' })
  format!: ExportFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: "L'invoiceId doit être un UUID valide." })
  invoiceId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message:
      'La méthode doit valoir BANK_TRANSFER, CARD, CASH, CHECK ou OTHER.',
  })
  method?: PaymentMethod;
}
```

#### ➕ Créer `src/modules/payments/application/export-payments.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ExportFormat } from '../../../common/enums/export-format.enum';
import { ExportTooLargeException } from '../../../common/exceptions/app-exceptions';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { ExportHelper } from '../../../common/utils/export.helper';
import { EXPORT_MAX_ROWS } from '../../../common/utils/export.constants';
import { GetInvoiceByIdUseCase } from '../../invoices/application/get-invoice-by-id.use-case';
import { Invoice } from '../../invoices/domain/invoice';
import { PaymentMethod } from '../domain/payment-method.enum';
import { PAYMENT_REPOSITORY } from '../domain/payment-repository.port';
import type { PaymentRepositoryPort } from '../domain/payment-repository.port';

/** Filtres d'export. */
export interface ExportPaymentsFilters {
  invoiceId?: string;
  method?: PaymentMethod;
  from?: Date;
  to?: Date;
}

const HEADERS = [
  'Facture',
  'Client',
  'Montant',
  'Méthode',
  'Référence',
  'Date de valeur',
  'Saisi par',
];

/**
 * Cas d'utilisation : exporter les paiements (CSV/XLSX).
 * Facture et client sont RÉSOLUS PAR FACTURE DISTINCTE (pas par ligne) :
 * un export de 10 000 paiements ne porte, en pratique, que sur quelques
 * centaines de factures — un Map évite les répétitions inutiles.
 */
@Injectable()
export class ExportPaymentsUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly getInvoiceByIdUseCase: GetInvoiceByIdUseCase,
  ) {}

  async execute(
    filters: ExportPaymentsFilters,
    format: ExportFormat,
  ): Promise<Buffer> {
    const result = await this.paymentRepository.findAll({
      page: 1,
      limit: EXPORT_MAX_ROWS + 1,
      sortDirection: SortDirection.Asc,
      invoiceId: filters.invoiceId,
      method: filters.method,
      from: filters.from,
      to: filters.to,
    });

    if (result.meta.totalItems > EXPORT_MAX_ROWS) {
      throw new ExportTooLargeException(
        result.meta.totalItems,
        EXPORT_MAX_ROWS,
      );
    }

    const invoicesById = new Map<string, Invoice>();
    for (const payment of result.items) {
      if (!invoicesById.has(payment.invoiceId)) {
        invoicesById.set(
          payment.invoiceId,
          await this.getInvoiceByIdUseCase.execute(payment.invoiceId),
        );
      }
    }

    const rows = result.items.map((payment) => {
      const invoice = invoicesById.get(payment.invoiceId) as Invoice;
      return [
        invoice.number,
        invoice.customerName,
        payment.amount,
        payment.method,
        payment.reference ?? '',
        payment.paidAt,
        payment.recordedBy,
      ];
    });

    return format === ExportFormat.Xlsx
      ? ExportHelper.toXLSX('Paiements', HEADERS, rows)
      : ExportHelper.toCSV(HEADERS, rows);
  }
}
```

#### ✏️ Modifier `src/modules/payments/presentation/payments.controller.ts`

Mêmes retouches. **Attention à l'ordre : ce contrôleur a DÉJÀ `GET overdue` déclarée avant `GET :id` (module 08) — ajoute `export` au même niveau, avant `:id` également** :

```typescript
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
      query.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="paiements-${date}.${query.format}"`,
    );
    return new StreamableFile(buffer);
  }
```

#### ✏️ Modifier `src/modules/payments/payments.module.ts`

Ajoute `ExportPaymentsUseCase` aux `providers`.

**✅ Point de contrôle** : `npm run build`

---

## Étape 4 — La recherche globale

Contrairement au tableau de bord (SQL brut, module 09), la recherche RÉUTILISE les repositories : chaque module sait déjà chercher par texte (`search`, posé au module 02). `SearchModule` importe donc quatre modules métier — ce n'est PAS un défaut, c'est le bon choix quand la capacité existe déjà.

> Crée l'arborescence `src/modules/search/`.

### ➕ Créer `src/modules/search/domain/search-result.ts`

```typescript
/** Catégories cherchées par la recherche globale. */
export enum SearchResultType {
  Contact = 'CONTACT',
  Product = 'PRODUCT',
  Order = 'ORDER',
  Invoice = 'INVOICE',
}

/**
 * Un résultat de recherche, prêt pour un front (l'`url` cible une route
 * FRONT-END — `/contacts/:id` —, pas un endpoint de cette API).
 */
export interface SearchResult {
  type: SearchResultType;
  id: string;
  label: string;
  subtitle: string;
  url: string;
}
```

### ➕ Créer `src/modules/search/application/global-search.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { CONTACT_REPOSITORY } from '../../contact/domain/contact-repository.port';
import type { ContactRepositoryPort } from '../../contact/domain/contact-repository.port';
import { PRODUCT_REPOSITORY } from '../../catalogue/domain/product-repository.port';
import type { ProductRepositoryPort } from '../../catalogue/domain/product-repository.port';
import { ORDER_REPOSITORY } from '../../orders/domain/order-repository.port';
import type { OrderRepositoryPort } from '../../orders/domain/order-repository.port';
import { INVOICE_REPOSITORY } from '../../invoices/domain/invoice-repository.port';
import type { InvoiceRepositoryPort } from '../../invoices/domain/invoice-repository.port';
import { SearchResult, SearchResultType } from '../domain/search-result';

/** 5 résultats par type, 20 au total (4 types). */
const RESULTS_PER_TYPE = 5;

/**
 * Cas d'utilisation : recherche globale.
 *
 * RÉUTILISE les repositories existants (findAll avec `search`) plutôt
 * que du SQL dédié : chaque module sait DÉJÀ chercher par texte depuis
 * le module 02 — le dupliquer ici serait de la duplication, pas de la
 * réutilisation transversale. Les 4 recherches partent en parallèle,
 * chacune ignorée si son type n'est pas demandé (`types`).
 */
@Injectable()
export class GlobalSearchUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: InvoiceRepositoryPort,
  ) {}

  async execute(q: string, types?: SearchResultType[]): Promise<SearchResult[]> {
    const wants = (type: SearchResultType): boolean =>
      types === undefined || types.includes(type);

    const [contacts, products, orders, invoices] = await Promise.all([
      wants(SearchResultType.Contact) ? this.searchContacts(q) : [],
      wants(SearchResultType.Product) ? this.searchProducts(q) : [],
      wants(SearchResultType.Order) ? this.searchOrders(q) : [],
      wants(SearchResultType.Invoice) ? this.searchInvoices(q) : [],
    ]);

    return [...contacts, ...products, ...orders, ...invoices];
  }

  private async searchContacts(q: string): Promise<SearchResult[]> {
    const result = await this.contactRepository.findAll({
      page: 1,
      limit: RESULTS_PER_TYPE,
      sortDirection: SortDirection.Asc,
      search: q,
    });
    return result.items.map((contact) => ({
      type: SearchResultType.Contact,
      id: contact.id,
      label: contact.companyName,
      subtitle: contact.type,
      url: `/contacts/${contact.id}`,
    }));
  }

  private async searchProducts(q: string): Promise<SearchResult[]> {
    const result = await this.productRepository.findAll({
      page: 1,
      limit: RESULTS_PER_TYPE,
      sortDirection: SortDirection.Asc,
      search: q,
    });
    return result.items.map((product) => ({
      type: SearchResultType.Product,
      id: product.id,
      label: product.name,
      subtitle: product.sku,
      url: `/products/${product.id}`,
    }));
  }

  private async searchOrders(q: string): Promise<SearchResult[]> {
    const result = await this.orderRepository.findAll({
      page: 1,
      limit: RESULTS_PER_TYPE,
      sortDirection: SortDirection.Desc,
      search: q,
    });
    return result.items.map((order) => ({
      type: SearchResultType.Order,
      id: order.id,
      label: order.number,
      subtitle: `${order.contactName} — ${order.status}`,
      url: `/orders/${order.id}`,
    }));
  }

  private async searchInvoices(q: string): Promise<SearchResult[]> {
    const result = await this.invoiceRepository.findAll({
      page: 1,
      limit: RESULTS_PER_TYPE,
      sortDirection: SortDirection.Desc,
      search: q,
    });
    return result.items.map((invoice) => ({
      type: SearchResultType.Invoice,
      id: invoice.id,
      label: invoice.number,
      subtitle: `${invoice.customerName} — ${invoice.status}`,
      url: `/invoices/${invoice.id}`,
    }));
  }
}
```

> 📌 Chaque recherche redemande `page: 1` : les ports EXIGENT déjà `page`/`sortDirection` (interfaces communes à toutes les listes) — les fournir ici ne coûte rien et évite un type dédié « recherche sans pagination ».

**✅ Point de contrôle** : `npm run build`

### ➕ Créer `src/modules/search/presentation/dto/search-query.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SearchResultType } from '../../domain/search-result';

/**
 * Query de GET /search.
 *
 * `types` peut arriver comme une chaîne UNIQUE (`?types=CONTACT`) ou un
 * tableau (`?types=CONTACT&types=PRODUCT`) selon le nombre de valeurs —
 * c'est le comportement standard du parseur de query d'Express. Le
 * `@Transform` normalise les deux cas en tableau AVANT la validation.
 */
export class SearchQueryDto {
  @ApiProperty({ description: 'Terme recherché (2 caractères minimum).', example: 'dupont' })
  @IsString()
  @MinLength(2, { message: 'Le paramètre "q" doit contenir au moins 2 caractères.' })
  q!: string;

  @ApiPropertyOptional({
    description: 'Types à chercher ; absent = tous les types.',
    enum: SearchResultType,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(SearchResultType, {
    each: true,
    message: 'Chaque type doit valoir CONTACT, PRODUCT, ORDER ou INVOICE.',
  })
  types?: SearchResultType[];
}
```

> 💡 **`q` trop court : 400 automatique.** `@MinLength(2)` est validé par le `ValidationPipe` global AVANT que le contrôleur ne soit appelé — aucune vérification manuelle à écrire dans le use case (contrairement à une règle métier qui dépend d'un état en base, une contrainte de FORME de l'entrée se valide toujours au DTO).

### ➕ Créer `src/modules/search/presentation/dto/search-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { SearchResult, SearchResultType } from '../../domain/search-result';

/** Représentation publique d'un résultat. */
export class SearchResultDto {
  @ApiProperty({ enum: SearchResultType })
  type!: SearchResultType;

  @ApiProperty({ description: 'Identifiant de la ressource (UUID).' })
  id!: string;

  @ApiProperty({ example: 'ACME Industries' })
  label!: string;

  @ApiProperty({ example: 'CUSTOMER' })
  subtitle!: string;

  @ApiProperty({
    description: 'Route FRONT-END (pas un endpoint de cette API).',
    example: '/contacts/3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  url!: string;

  static fromDomain(result: SearchResult): SearchResultDto {
    const dto = new SearchResultDto();
    dto.type = result.type;
    dto.id = result.id;
    dto.label = result.label;
    dto.subtitle = result.subtitle;
    dto.url = result.url;
    return dto;
  }
}

/** Réponse de GET /search : résultats groupés par type. */
export class SearchResponseDto {
  @ApiProperty({ example: 'dupont' })
  query!: string;

  @ApiProperty({
    description: 'Résultats groupés par type ; une clé absente = aucun résultat de ce type.',
    example: {
      CONTACT: [],
      PRODUCT: [],
      ORDER: [],
      INVOICE: [],
    },
  })
  results!: Partial<Record<SearchResultType, SearchResultDto[]>>;

  @ApiProperty({ description: 'Nombre total de résultats (tous types confondus).', example: 7 })
  total!: number;

  static fromResults(query: string, results: SearchResult[]): SearchResponseDto {
    const dto = new SearchResponseDto();
    dto.query = query;
    dto.total = results.length;
    dto.results = {};
    for (const result of results) {
      const dtoResult = SearchResultDto.fromDomain(result);
      const bucket = dto.results[result.type] ?? [];
      bucket.push(dtoResult);
      dto.results[result.type] = bucket;
    }
    return dto;
  }
}
```

### ➕ Créer `src/modules/search/presentation/search.controller.ts`

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GlobalSearchUseCase } from '../application/global-search.use-case';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';

/** Contrôleur de recherche globale — ouvert à tout utilisateur connecté. */
@ApiTags('Recherche')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly globalSearchUseCase: GlobalSearchUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Recherche globale',
    description:
      'Contacts, produits, commandes, factures — 5 résultats par type ' +
      '(20 au total). `q` : 2 caractères minimum. `types` filtre les ' +
      'catégories cherchées.',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  async search(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    const results = await this.globalSearchUseCase.execute(query.q, query.types);
    return SearchResponseDto.fromResults(query.q, results);
  }
}
```

### ➕ Créer `src/modules/search/search.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ContactsModule } from '../contact/contacts.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { OrdersModule } from '../orders/orders.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { GlobalSearchUseCase } from './application/global-search.use-case';
import { SearchController } from './presentation/search.controller';

/**
 * Module de recherche globale.
 *
 * Importe QUATRE modules métier (contacts, catalogue, commandes,
 * factures) : ce n'est PAS un défaut de conception — la recherche
 * réutilise volontairement leurs repositories déjà exportés plutôt que
 * de dupliquer leur logique de recherche textuelle. Aucun de ces
 * modules n'importe Search en retour : pas de cycle.
 *
 * Rien n'est exporté : personne ne consomme un résultat de recherche.
 */
@Module({
  imports: [ContactsModule, CatalogueModule, OrdersModule, InvoicesModule],
  controllers: [SearchController],
  providers: [GlobalSearchUseCase],
})
export class SearchModule {}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 5 — Exposer l'audit et l'historique par ressource

> ⚠️ Relis le § 0.1 avant de tester cette étape : la lecture fonctionnera, mais restera VIDE pour les ressources métier tant que leurs use cases n'appellent pas `AuditService.log(...)`.

### 5.1 · Le domaine de lecture

`AuditLogRepositoryPort` ne savait qu'`insert()` — il lui faut maintenant un modèle de LECTURE et une méthode de recherche.

#### ➕ Créer `src/modules/audit/domain/audit-log.ts`

```typescript
import { AuditCategory } from './audit-category.enum';

/** Modèle de lecture d'un événement d'audit — le journal est immuable. */
export class AuditLog {
  constructor(
    public readonly id: string,
    public readonly category: AuditCategory,
    /** Action technique stable, ex. : payments.recorded */
    public readonly action: string,
    public readonly actorUserId: string | null,
    public readonly resourceType: string | null,
    public readonly resourceId: string | null,
    public readonly requestId: string | null,
    public readonly ipAddress: string | null,
    /** JSON déjà filtré des valeurs sensibles à l'écriture. */
    public readonly metadata: string | null,
    public readonly createdAt: Date,
  ) {}
}
```

### ✏️ Modifier `src/modules/audit/domain/audit-log-repository.port.ts`

Ajoute, à la fin du fichier :

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { AuditLog } from './audit-log';

/** Critères de listing du journal d'audit. */
export interface ListAuditLogsQuery {
  page: number;
  limit: number;
  /** Tri fixe sur createdAt : un journal se lit chronologiquement, pas
   *  par colonne libre — seule la DIRECTION est configurable. */
  sortDirection: SortDirection;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string;
  action?: string;
  category?: AuditCategory;
  from?: Date;
  to?: Date;
}
```

Puis ajoute la méthode dans l'interface `AuditLogRepositoryPort` (après `insert`) :

```typescript
  /** Liste paginée et filtrable — la première LECTURE du journal. */
  findAll(query: ListAuditLogsQuery): Promise<PaginatedResult<AuditLog>>;
```

### ✏️ Modifier `src/modules/audit/infrastructure/typeorm-audit-log.repository.ts`

Ajoute l'implémentation, après `insert` :

```typescript
import { PaginatedResult } from '../../../../common/pagination/paginated-result';
import { TypeOrmPaginationHelper } from '../../../../common/pagination/typeorm-pagination.helper';
import { AuditLog } from '../../domain/audit-log';
import { ListAuditLogsQuery } from '../../domain/audit-log-repository.port';

  async findAll(query: ListAuditLogsQuery): Promise<PaginatedResult<AuditLog>> {
    const queryBuilder = this.repository.createQueryBuilder('log');

    if (query.resourceType !== undefined) {
      queryBuilder.andWhere('log.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    }
    if (query.resourceId !== undefined) {
      queryBuilder.andWhere('log.resourceId = :resourceId', {
        resourceId: query.resourceId,
      });
    }
    if (query.actorUserId !== undefined) {
      queryBuilder.andWhere('log.actorUserId = :actorUserId', {
        actorUserId: query.actorUserId,
      });
    }
    if (query.action !== undefined) {
      queryBuilder.andWhere('log.action = :action', { action: query.action });
    }
    if (query.category !== undefined) {
      queryBuilder.andWhere('log.category = :category', {
        category: query.category,
      });
    }
    if (query.from !== undefined) {
      queryBuilder.andWhere('log.createdAt >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      queryBuilder.andWhere('log.createdAt <= :to', { to: query.to });
    }

    queryBuilder.orderBy('log.createdAt', query.sortDirection);

    const result = await TypeOrmPaginationHelper.paginate(
      queryBuilder,
      query.page,
      query.limit,
    );

    return {
      items: result.items.map(
        (entity) =>
          new AuditLog(
            entity.id,
            entity.category,
            entity.action,
            entity.actorUserId,
            entity.resourceType,
            entity.resourceId,
            entity.requestId,
            entity.ipAddress,
            entity.metadata,
            entity.createdAt,
          ),
      ),
      meta: result.meta,
    };
  }
```

> 💡 Pas de mapper dédié ici (contrairement aux modules à entités riches) : la conversion tient en une ligne, directement dans le repository — un `AuditLogMapper` séparé n'ajouterait qu'un fichier de plus pour zéro gain de lisibilité.

### 5.2 · L'exposition

#### ➕ Créer `src/modules/audit/application/list-audit-logs.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { AuditLog } from '../domain/audit-log';
import {
  AUDIT_LOG_REPOSITORY,
  ListAuditLogsQuery,
} from '../domain/audit-log-repository.port';
import type { AuditLogRepositoryPort } from '../domain/audit-log-repository.port';

/** Cas d'utilisation : lister le journal d'audit (pagination + filtres). */
@Injectable()
export class ListAuditLogsUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  execute(query: ListAuditLogsQuery): Promise<PaginatedResult<AuditLog>> {
    return this.auditLogRepository.findAll(query);
  }
}
```

#### ➕ Créer `src/modules/audit/presentation/dto/audit-log-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { AuditCategory } from '../../domain/audit-category.enum';
import { AuditLog } from '../../domain/audit-log';

/** Représentation publique d'un événement d'audit. */
export class AuditLogResponseDto {
  @ApiProperty({ description: "Identifiant de l'événement (UUID)." })
  id!: string;

  @ApiProperty({ enum: AuditCategory })
  category!: AuditCategory;

  @ApiProperty({ example: 'payments.recorded' })
  action!: string;

  @ApiProperty({ nullable: true, description: "UUID de l'acteur ; null si anonyme/système." })
  actorUserId!: string | null;

  @ApiProperty({ nullable: true, example: 'invoice' })
  resourceType!: string | null;

  @ApiProperty({ nullable: true })
  resourceId!: string | null;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true, description: 'Corrélation avec les logs techniques.' })
  requestId!: string | null;

  @ApiProperty({ nullable: true, description: 'Contexte JSON, déjà filtré des valeurs sensibles.' })
  metadata!: string | null;

  @ApiProperty()
  createdAt!: Date;

  static fromDomain(log: AuditLog): AuditLogResponseDto {
    const dto = new AuditLogResponseDto();
    dto.id = log.id;
    dto.category = log.category;
    dto.action = log.action;
    dto.actorUserId = log.actorUserId;
    dto.resourceType = log.resourceType;
    dto.resourceId = log.resourceId;
    dto.ipAddress = log.ipAddress;
    dto.requestId = log.requestId;
    dto.metadata = log.metadata;
    dto.createdAt = log.createdAt;
    return dto;
  }
}
```

#### ➕ Créer `src/modules/audit/presentation/dto/list-audit-logs-query.dto.ts`

```typescript
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DateRangeDto } from '../../../../common/pagination/date-range.dto';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { AuditCategory } from '../../domain/audit-category.enum';

/**
 * Query de GET /audit-logs.
 * `sortBy` et `search`, hérités de PaginationQueryDto, sont IGNORÉS ici :
 * le journal se filtre par ressource/acteur/action/catégorie/période,
 * jamais par tri libre ni recherche plein texte — un choix volontaire,
 * comme l'absence de recherche textuelle au module 08 (paiements).
 */
export class ListAuditLogsQueryDto extends IntersectionType(
  PaginationQueryDto,
  DateRangeDto,
) {
  @ApiPropertyOptional({ example: 'invoice' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: "Le paramètre \"actorUserId\" doit être un UUID valide." })
  actorUserId?: string;

  @ApiPropertyOptional({ example: 'payments.recorded' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ enum: AuditCategory })
  @IsOptional()
  @IsEnum(AuditCategory, {
    message: 'La catégorie doit valoir TECHNICAL, BUSINESS, SECURITY ou AUDIT.',
  })
  category?: AuditCategory;
}
```

#### ➕ Créer `src/modules/audit/presentation/audit.controller.ts`

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { ListAuditLogsUseCase } from '../application/list-audit-logs.use-case';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

/** Contrôleur du journal d'audit — lecture seule, ADMIN uniquement. */
@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly listAuditLogsUseCase: ListAuditLogsUseCase) {}

  @Get()
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'Journal d’audit complet',
    description:
      'Filtres : resourceType, resourceId, actorUserId, action, ' +
      'category, from/to (ISO). Lecture seule : aucune modification ' +
      'possible, ce module n’expose ni PATCH ni DELETE.',
  })
  @ApiOkResponse({ type: [AuditLogResponseDto] })
  async list(
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    const result = await this.listAuditLogsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortDirection: query.sortDirection,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      actorUserId: query.actorUserId,
      action: query.action,
      category: query.category,
      from: query.from !== undefined ? new Date(query.from) : undefined,
      to: query.to !== undefined ? new Date(query.to) : undefined,
    });

    return {
      items: result.items.map(AuditLogResponseDto.fromDomain),
      meta: result.meta,
    };
  }
}
```

### ✏️ Modifier `src/modules/audit/audit.module.ts`

**1)** Ajoute les imports :

```typescript
import { ListAuditLogsUseCase } from './application/list-audit-logs.use-case';
import { AuditController } from './presentation/audit.controller';
```

**2)** Ajoute `controllers` (nouveau tableau) et le use case aux `providers`, puis exporte-le :

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  controllers: [AuditController],
  providers: [
    AuditService,
    ListAuditLogsUseCase,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: TypeOrmAuditLogRepository,
    },
  ],
  exports: [AuditService, ListAuditLogsUseCase],
})
export class AuditModule {}
```

**3)** Mets à jour le commentaire du module (il annonçait « aucun contrôleur » — ce n'est plus vrai) :

**AVANT** :

```typescript
 * Aucun contrôleur : le journal est immuable et ne s'expose pas via
 * l'API dans cette version du socle.
 */
```

**APRÈS** :

```typescript
 * AuditController expose le journal en LECTURE SEULE (GET /audit-logs,
 * ADMIN) : immuable ne veut pas dire invisible. ListAuditLogsUseCase
 * est exporté pour les endpoints « /*/history » des autres modules
 * (module 10).
 */
```

> `app.module.ts` importe déjà `AuditModule` depuis le socle (étape 15) — rien à y toucher pour cette partie.

**✅ Point de contrôle** : `npm run build`

### 5.3 · Les endpoints de commodité `/:id/history`

Cinq contrôleurs, un alias chacun de `GET /audit-logs?resourceType=X&resourceId=:id`. Comme pour l'export, chaque module DOIT importer `AuditModule` pour injecter `ListAuditLogsUseCase`.

#### ✏️ Modifier `src/modules/contact/contacts.module.ts`

Ajoute `AuditModule` aux `imports` :

```typescript
import { AuditModule } from '../audit/audit.module';
// ...
  imports: [
    // ... imports existants ...
    AuditModule,
  ],
```

#### ✏️ Modifier `src/modules/contact/presentation/contacts.controller.ts`

Ajoute les imports (`ListAuditLogsUseCase`, `AuditLogResponseDto`, `PaginationQueryDto`, `PaginatedResult` s'il n'est pas déjà importé), le use case au constructeur, et la route — à la fin de la classe, après `remove` (ici, PAS de piège d'ordre : `:id/history` a un segment de PLUS que `:id`, Nest les distingue sans ambiguïté) :

```typescript
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
```

#### ✏️ Répète pour les quatre autres modules

Même patron EXACT — seul `resourceType` et le rôle changent :

| Module | Contrôleur | `resourceType` | Rôle |
|---|---|---|---|
| `catalogue` | `products.controller.ts` | `'product'` | ADMIN, MANAGER |
| `orders` | `orders.controller.ts` | `'order'` | *(aucun `@Roles` — tout connecté)* |
| `invoices` | `invoices.controller.ts` | `'invoice'` | *(aucun `@Roles` — tout connecté)* |
| `payments` | `payments.controller.ts` | `'payment'` | ADMIN, MANAGER |

Pour chacun : import `AuditModule` dans le `.module.ts`, import `ListAuditLogsUseCase`/`AuditLogResponseDto`/`PaginationQueryDto` dans le contrôleur, le use case au constructeur, la méthode `history` avec le `resourceType` du tableau.

> 📌 **Cohérence des `resourceType`** : ces chaînes (`'contact'`, `'product'`, `'order'`, `'invoice'`, `'payment'`) devront être EXACTEMENT celles utilisées le jour où chaque module appellera enfin `AuditService.log({ resourceType: '...', ... })` (le chantier différé du § 0.1). Fixe-les maintenant, au singulier, et ne les fais plus varier ensuite — un journal qui change le nom de ses ressources en cours de route devient impossible à filtrer correctement.

**✅ Point de contrôle** : `npm run build`

---

## Étape 6 — Le module + AppModule

### ✏️ Modifier `src/app.module.ts`

**1)** Ajoute l'import :

```typescript
import { SearchModule } from './modules/search/search.module';
```

**2)** Dans le tableau `imports`, après `DashboardModule` (ou en fin de liste des modules métier) :

```typescript
    DashboardModule,
    SearchModule,
    AuthenticationModule,
```

> `AuditModule` est déjà présent dans `imports` depuis le socle — inutile de le rajouter, seul son CONTENU a changé (étape 5).

**✅ Point de contrôle** :

```bash
npm run build
npm run start:dev
```

Les logs listent : `GET /api/v1/search`, `GET /api/v1/audit-logs`, les 5 routes `*/export` et les 5 routes `*/:id/history`. Swagger affiche les sections « Recherche » et « Audit », et chaque contrôleur métier gagne deux opérations.

---

## Étape 7 — Vérifier que ça marche & ce qu'on verra plus tard

### 7.1 Parcours manuel (PowerShell)

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion + un minimum de données (client, produit)
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

$client = Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"type":"CUSTOMER","companyName":"ACME Industries","email":"compta@acme-industries.fr"}'
$prod = Invoke-RestMethod -Method Post -Uri "$base/products" -Headers $headers `
  -ContentType 'application/json' `
  -Body '{"name":"Écran Dell 27\" QHD","type":"PRODUCT","unit":"UNIT","unitPrice":349.90}'

# 2. Recherche globale : "ACME" doit ressortir en CONTACT
Invoke-RestMethod -Uri "$base/search?q=ACME" -Headers $headers | ConvertTo-Json -Depth 5

# 3. q trop court -> 400
try {
  Invoke-RestMethod -Uri "$base/search?q=A" -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : BadRequest (400)
}

# 4. Filtrer les types cherchés
Invoke-RestMethod -Uri "$base/search?q=ecran&types=PRODUCT" -Headers $headers |
  ConvertTo-Json -Depth 5

# 5. Export CSV des contacts (fichier binaire, Content-Disposition attendu)
Invoke-WebRequest -Uri "$base/contacts/export?format=csv" -Headers $headers `
  -OutFile "contacts.csv"
Get-Content contacts.csv -Encoding UTF8 | Select-Object -First 3

# 6. Export XLSX
Invoke-WebRequest -Uri "$base/contacts/export?format=xlsx" -Headers $headers `
  -OutFile "contacts.xlsx"

# 7. Format absent -> 400 (validation du DTO)
try {
  Invoke-RestMethod -Uri "$base/products/export" -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : BadRequest (400)
}

# 8. Le journal d'audit : login = déjà tracé (socle, authentication)
Invoke-RestMethod -Uri "$base/audit-logs?category=SECURITY&limit=5" -Headers $headers |
  ConvertTo-Json -Depth 5
# -> au moins l'événement auth.login.success de l'étape 1

# 9. L'historique d'un contact : VIDE pour l'instant (§ 0.1)
(Invoke-RestMethod -Uri "$base/contacts/$($client.data.id)/history" -Headers $headers).data.items.Count
# -> 0 : attendu tant que ContactsModule n'appelle pas AuditService.log()

# 10. audit-logs réservé à ADMIN -> 403 pour un MANAGER (à adapter selon tes comptes de test)
```

Même parcours possible à la souris dans **Swagger**, ou via la collection **`postman-10-transversal-recherche-exports-historique.json`**.

### 7.2 Les pièges croisés en route (mémo)

| Piège | Parade |
|---|---|
| `GET /contacts/export` capté par `GET /contacts/:id` (400 UUID) | Route STATIQUE déclarée avant la route PARAMÉTRÉE — cinq fois |
| Export tronqué silencieusement au-delà de 10 000 lignes | `422 EXPORT_TOO_LARGE` explicite, jamais de troncature muette |
| CSV illisible dans Excel (accents) | BOM UTF-8 (`﻿`) en tête de fichier |
| `SUM`/agrégats d'export qui ignorent les transformers | Ici non concerné : les exports relisent des domaines déjà mappés (pas de SQL brut) |
| Recherche globale qui réinvente `LIKE` en SQL | Réutilise `findAll({ search })` : chaque module sait déjà chercher |
| `?types=PRODUCT` (une valeur) devient une chaîne, pas un tableau | `@Transform` normalise en tableau AVANT validation |
| Historique vide alors que « ça devrait marcher » | Normal : aucun module métier n'appelle encore `AuditService.log()` (§ 0.1) |
| Produits : une requête de catégorie par ligne exportée | Toutes les catégories chargées UNE fois, résolues via `Map` |
| Paiements : une requête de facture par ligne exportée | Factures DÉDUPLIQUÉES par `invoiceId` avant résolution |

### 7.3 Ce qu'on verra plus tard (rien n'est perdu)

| Différé | Pourquoi ce n'est pas bloquant | Niveau |
|---|---|---|
| **Instrumentation `AuditService.log()`** dans les use cases métier (contacts, produits, devis, commandes, factures, paiements) | La LECTURE est prête et attend l'ÉCRITURE — un chantier module par module, indépendant de celui-ci | 🟡 min- (dette explicite depuis le module 02) |
| **Export streamé** (pas de chargement intégral en mémoire avant écriture) | 10 000 lignes tiennent confortablement en mémoire pour une démo | 🟡 min- |
| **Recherche floue / pertinence** (au-delà du `LIKE %q%`) | Le `LIKE` insensible à la casse suffit à une démo | 🟡 min- |
| **Cache de la recherche globale** | Requêtes déjà limitées à 5 lignes par type, quatre repositories rapides | 🟡 min- |
| **Tests** (unit : plafond d'export, normalisation `types`, dédup facture/catégorie ; e2e : CSV/XLSX valides, filtres du journal) | L'application fonctionne ; garantie long terme | 🔴 complet |

### 7.4 Ce que ce module t'a appris de nouveau

1. **« Transversal » ne veut pas dire « nouvelle table »** : ce module modifie 16 fichiers et n'en crée que 25 pour ajouter 12 routes, sans la moindre migration.
2. **Choisir entre réutiliser un repository et descendre au SQL brut** : la recherche globale réutilise (la capacité existe déjà) ; le dashboard (module 09) descendait au SQL (aucun repository ne fait de `SUM`/`TOP N`) — le même problème n'a pas toujours la même réponse.
3. **Le garde-fou explicite plutôt que la troncature silencieuse** : 422 quand la limite est dépassée, jamais un export qui ment sur son exhaustivité.
4. **La dette documentée reste utile** : chaque « 🟡 min- » des guides 02 à 08 (« l'audit est un plus ») retrouve ici sa raison d'être — la LECTURE qui l'attendait.
5. **L'ordre des routes, une dernière fois, à grande échelle** : le piège du module 08 (`overdue` avant `:id`) se généralise à cinq contrôleurs — une règle, pas un cas particulier.

---

*Fin du guide mini-DEV-10 — et du parcours des dix modules. L'ERP dispose maintenant de son socle technique (00), de sa gestion commerciale complète (01 à 08 : utilisateurs, contacts, catalogue, stock, devis, commandes, facturation, paiements), de son pilotage (09 : tableau de bord) et de ses capacités transverses (10 : recherche, exports, audit). Niveau min- : PDF réels, e-mails transactionnels, tests automatisés, instrumentation complète de l'audit — le chemin est balisé, module par module.*
