# 10 · Transversal — Recherche, Filtres, Pagination, Exports & Historique

> **Dépendances** : tous les modules précédents  
> **Modules réutilisés** : `Audit`

---

## Contexte

Ce module regroupe les fonctionnalités transversales partagées par l'ensemble de l'application. Certaines (pagination, filtres) doivent être posées **dès le module 02** et réutilisées partout. D'autres (exports, recherche globale) peuvent être implémentées en dernier une fois les modules métier stables.

---

## 1 · Pagination & Filtres communs

> ⚠️ À implémenter dès le module 02, avant tous les autres modules.

### DTOs communs

- [ ] Créer `src/common/dto/pagination.dto.ts`
  ```ts
  export class PaginationDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number = 1;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
    limit?: number = 20;

    @IsOptional() @IsString()
    sortBy?: string;

    @IsOptional() @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
  }
  ```

- [ ] Créer `src/common/dto/paginated-response.dto.ts`
  ```ts
  export class PaginatedResponseDto<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
  ```

- [ ] Créer `src/common/dto/date-range.dto.ts`
  ```ts
  export class DateRangeDto {
    @IsOptional() @IsDateString()
    from?: string;

    @IsOptional() @IsDateString()
    to?: string;
  }
  ```

### Helper de pagination

- [ ] Créer `src/common/utils/pagination.helper.ts`
  - `applyPagination(qb, dto: PaginationDto)` — applique skip/take sur un QueryBuilder
  - `toPaginatedResponse<T>(data: T[], total: number, dto: PaginationDto): PaginatedResponseDto<T>`

### Vérification

- [ ] Confirmer que **tous** les modules suivants utilisent `PaginationDto` et retournent `PaginatedResponseDto<T>` :
  - [ ] `GET /contacts`
  - [ ] `GET /products`
  - [ ] `GET /quotes`
  - [ ] `GET /orders`
  - [ ] `GET /invoices`
  - [ ] `GET /payments`
  - [ ] `GET /stock`
  - [ ] `GET /stock/movements`

---

## 2 · Recherche globale

- [ ] Créer `src/modules/search/domain/search-result.ts`
  ```ts
  export enum SearchResultType {
    Contact = 'CONTACT',
    Product = 'PRODUCT',
    Order   = 'ORDER',
    Invoice = 'INVOICE',
  }

  export interface SearchResult {
    type     : SearchResultType;
    id       : string;
    label    : string;     // ex : nom société ou numéro
    subtitle : string;     // ex : type/statut
    url      : string;     // ex : /contacts/uuid
  }
  ```

- [ ] Créer `GlobalSearchUseCase`
  - Paramètre : `q: string` (min 2 caractères), `types?: SearchResultType[]`
  - Exécute en parallèle (`Promise.all`) :
    - Recherche dans `contacts` : sur `companyName`, `email`
    - Recherche dans `products` : sur `sku`, `name`
    - Recherche dans `orders` : sur `number`, contact associé
    - Recherche dans `invoices` : sur `number`, contact associé
  - Retourne max 5 résultats par type (20 au total)
  - Si `types` fourni : filtre les types
  - Utilise `ILIKE %q%` (PostgreSQL) ou `LIKE` (case-insensitive)

- [ ] Créer `SearchController`

### DTOs

- [ ] `SearchResultDto`
  - `type`, `id`, `label`, `subtitle`, `url`

- [ ] `SearchResponseDto`
  - `query: string`
  - `results: { [key in SearchResultType]?: SearchResultDto[] }`
  - `total: number`

### Endpoint

- [ ] `GET /search` — tous les rôles
  - Query : `q: string` (MinLength 2), `types?: SearchResultType[]`
  - Retourne `SearchResponseDto`

---

## 3 · Exports (CSV & XLSX)

### Librairies

- [ ] Installer `exceljs` : `npm install exceljs`
- [ ] Créer `src/common/utils/export.helper.ts`
  - `toCSV(headers: string[], rows: string[][]): Buffer`
  - `toXLSX(sheetName: string, headers: string[], rows: any[][]): Promise<Buffer>`

### Use Cases d'export (un par module)

- [ ] **`ExportContactsUseCase`**
  - Colonnes : type, companyName, contactName, email, phone, city, country, siret, vatNumber, isActive

- [ ] **`ExportProductsUseCase`**
  - Colonnes : sku, name, type, category, unitPrice, purchasePrice, vatRate, unit, isActive

- [ ] **`ExportOrdersUseCase`**
  - Colonnes : number, type, status, contact, totalHT, totalTTC, expectedDeliveryDate, deliveredAt, createdAt

- [ ] **`ExportInvoicesUseCase`**
  - Colonnes : number, type, status, customer, issueDate, dueDate, totalHT, totalTTC, paidAmount, remainingAmount

- [ ] **`ExportPaymentsUseCase`**
  - Colonnes : invoiceNumber, customer, amount, method, reference, paidAt, recordedBy

### Endpoints (ajoutés dans chaque controller respectif)

- [ ] `GET /contacts/export` — `@Roles(Admin, Manager)`
  - Query : `format: 'csv' | 'xlsx'` + tous les filtres habituels (sans pagination)
  - Headers : `Content-Disposition: attachment; filename="contacts-YYYY-MM-DD.{format}"`

- [ ] `GET /products/export` — `@Roles(Admin, Manager)`

- [ ] `GET /orders/export` — `@Roles(Admin, Manager)`

- [ ] `GET /invoices/export` — `@Roles(Admin, Manager)`

- [ ] `GET /payments/export` — `@Roles(Admin, Manager)`

---

## 4 · Historique des modifications (Audit Log)

Le module `audit` persiste déjà tous les événements. Ici on ajoute l'exposition via des endpoints.

### Nouveaux Use Cases dans `AuditModule`

- [ ] **`ListAuditLogsUseCase`**
  - Filtre : `resourceType?`, `resourceId?`, `actorUserId?`, `action?`, `category?`, `from?`, `to?`
  - Pagination
  - Retourne les logs avec détails de l'acteur

### DTOs (dans `audit/presentation/`)

- [ ] `AuditLogResponseDto`
  - `id`, `category`, `action`, `actorUserId`, `resourceType`, `resourceId`
  - `ipAddress`, `requestId`, `metadata`, `createdAt`

- [ ] `AuditLogsPageDto`

### Endpoints

- [ ] `GET /audit-logs` — `@Roles(Admin)`
  - Query : `resourceType`, `resourceId`, `actorUserId`, `action`, `from`, `to`, `page`, `limit`
  - Retourne `AuditLogsPageDto`

**Endpoints de commodité par entité** (dans chaque controller respectif) :

- [ ] `GET /contacts/:id/history` — `@Roles(Admin, Manager)`
  - Alias de `GET /audit-logs?resourceType=contact&resourceId=:id`

- [ ] `GET /products/:id/history` — `@Roles(Admin, Manager)`

- [ ] `GET /orders/:id/history` — tous les rôles

- [ ] `GET /invoices/:id/history` — tous les rôles

- [ ] `GET /payments/:id/history` — `@Roles(Admin, Manager)`

---

## 5 · Checklist d'ordre d'implémentation

L'ordre suggéré pour intégrer ces fonctionnalités transversales au fil des modules :

| Étape | Quand | Quoi |
|-------|-------|------|
| 1 | Avant module 02 | `PaginationDto`, `PaginatedResponseDto`, `DateRangeDto`, `pagination.helper.ts` |
| 2 | Dans chaque module | Intégrer pagination + filtres dans tous les `findAll` |
| 3 | Après module 08 | `ExportContactsUseCase` + endpoint `/contacts/export` |
| 4 | Après module 08 | Export produits, commandes, factures, paiements |
| 5 | Après module 08 | `ListAuditLogsUseCase` + `GET /audit-logs` |
| 6 | Après module 08 | Endpoints `/*/history` dans chaque controller |
| 7 | En dernier | `GlobalSearchUseCase` + `GET /search` |

---

## 6 · Règles métier

| Règle | Détail |
|-------|--------|
| Export sans pagination | Les exports ignorent `page`/`limit` et retournent toutes les données (avec les mêmes filtres) |
| Taille max export | Limiter à 10 000 lignes pour éviter les timeouts — retourner une erreur 422 si dépassé |
| Recherche globale | Minimum 2 caractères, sinon 400 |
| Audit logs | En lecture seule, jamais modifiables |
| Encodage CSV | UTF-8 avec BOM pour compatibilité Excel |

---

## 7 · Tests

- [ ] **Unit** : `toCSV()` — encodage correct, BOM UTF-8
- [ ] **Unit** : `toXLSX()` — structure correcte du workbook
- [ ] **Unit** : `GlobalSearchUseCase` — retourne max 5 par type
- [ ] **Unit** : `GlobalSearchUseCase` — q < 2 chars → BadRequestException
- [ ] **Unit** : `ListAuditLogsUseCase` — filtres multiples
- [ ] **E2E** : `GET /contacts/export?format=csv` — réponse binaire avec bon Content-Type
- [ ] **E2E** : `GET /contacts/export?format=xlsx`
- [ ] **E2E** : `GET /search?q=dupont` — résultats groupés par type
- [ ] **E2E** : `GET /audit-logs?resourceType=invoice` — retourne uniquement les logs invoice
