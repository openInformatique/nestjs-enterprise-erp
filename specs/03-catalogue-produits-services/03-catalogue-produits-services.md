# 03 · Catalogue — Produits & Services

> **Dépendances** : `UsersModule` (rôles)  
> **Modules réutilisés** : `Audit`, `Storage` (upload image)

---

## Contexte

Le catalogue gère deux types d'items :
- **PRODUCT** : bien physique, affecte le stock
- **SERVICE** : prestation, n'affecte pas le stock

Les produits sont organisés en catégories hiérarchiques simples (1 niveau de sous-catégorie suffit pour la démo).

---

## 1 · Domaine — Catégories

- [ ] Créer `src/modules/catalogue/domain/category.ts`
  ```
  id          : string
  name        : string
  description : string | null
  parentId    : string | null   (1 niveau max recommandé)
  isActive    : boolean
  createdAt   : Date
  updatedAt   : Date
  ```

- [ ] Créer `src/modules/catalogue/domain/category-repository.port.ts`
  - `findAll(filters): Promise<Category[]>`
  - `findById(id): Promise<Category | null>`
  - `create(data): Promise<Category>`
  - `update(id, data): Promise<Category>`
  - `delete(id): Promise<void>`
  - `hasProducts(id): Promise<boolean>`

---

## 2 · Domaine — Produits

- [ ] Créer `src/modules/catalogue/domain/product-type.enum.ts`
  ```ts
  export enum ProductType {
    Product = 'PRODUCT',
    Service = 'SERVICE',
  }
  ```

- [ ] Créer `src/modules/catalogue/domain/product-unit.enum.ts`
  ```ts
  export enum ProductUnit {
    Unit   = 'UNIT',   // pièce
    Kg     = 'KG',
    Liter  = 'LITER',
    Hour   = 'HOUR',
    Day    = 'DAY',
    Meter  = 'METER',
  }
  ```

- [ ] Créer `src/modules/catalogue/domain/product.ts`
  ```
  id            : string
  sku           : string          (unique, ex : PROD-0001)
  name          : string
  description   : string | null
  type          : ProductType
  categoryId    : string | null
  unitPrice     : number          (prix de vente HT, en centimes ou décimal)
  purchasePrice : number | null   (prix d'achat HT)
  vatRate       : number          (défaut : 20)
  unit          : ProductUnit
  isActive      : boolean
  imageUrl      : string | null
  createdAt     : Date
  updatedAt     : Date
  ```

- [ ] Créer `src/modules/catalogue/domain/product-repository.port.ts`
  - `findAll(filters, pagination): Promise<{ products: Product[]; total: number }>`
  - `findById(id): Promise<Product | null>`
  - `findBySku(sku): Promise<Product | null>`
  - `create(data): Promise<Product>`
  - `update(id, data): Promise<Product>`
  - `softDelete(id): Promise<void>`
  - `hasActiveUsages(id): Promise<boolean>` (devis/commandes actifs)

---

## 3 · Infrastructure — Catégories

- [ ] Créer `TypeOrmCategoryEntity`
  - Table `categories`
  - Self-join : `@ManyToOne(() => Category)` + `@OneToMany(() => Category)` pour `parentId`
  - Index sur `name`

- [ ] Créer migration `CreateCategoriesTable`

- [ ] Implémenter `TypeOrmCategoryRepository`

- [ ] Créer `CategoryMapper`

---

## 4 · Infrastructure — Produits

- [ ] Créer `TypeOrmProductEntity`
  - Table `products`
  - `@ManyToOne(() => TypeOrmCategoryEntity)` pour `categoryId`
  - `sku` : colonne unique
  - `unit_price`, `purchase_price` : `decimal(12,2)` (éviter les virgules flottantes)
  - `@DeleteDateColumn()` pour soft-delete
  - Index sur `sku`, `name`, `type`

- [ ] Créer migration `CreateProductsTable`

- [ ] Implémenter `TypeOrmProductRepository`

- [ ] Créer `ProductMapper`

---

## 5 · Application — Use Cases Catégories

- [ ] **`ListCategoriesUseCase`**
  - Retourne l'arbre plat (toutes catégories, avec `parentId`)
  - Filtre : `isActive?`

- [ ] **`GetCategoryByIdUseCase`**
  - Lève `ResourceNotFoundException` si inexistant

- [ ] **`CreateCategoryUseCase`**
  - Vérifie que `parentId` existe si fourni
  - Logge `categories.created`

- [ ] **`UpdateCategoryUseCase`**
  - Logge `categories.updated`

- [ ] **`DeleteCategoryUseCase`**
  - Vérifie `hasProducts()` → lève `ConflictException` si produits actifs liés
  - Logge `categories.deleted`

---

## 6 · Application — Use Cases Produits

- [ ] **`ListProductsUseCase`**
  - Filtre : `categoryId?`, `type?`, `isActive?`, `search?` (sur `sku` / `name`)
  - Pagination : `page`, `limit`, `sortBy`, `sortOrder`

- [ ] **`GetProductByIdUseCase`**
  - Lève `ResourceNotFoundException` si inexistant ou soft-deleted

- [ ] **`CreateProductUseCase`**
  - Vérifie unicité du SKU
  - Auto-génère le SKU si non fourni (`PROD-XXXX` avec padding)
  - Logge `products.created`

- [ ] **`UpdateProductUseCase`**
  - Si SKU modifié : vérifie unicité
  - Logge `products.updated`

- [ ] **`DeleteProductUseCase`**
  - Vérifie `hasActiveUsages()` → `ConflictException`
  - Soft-delete
  - Logge `products.deleted`

- [ ] **`UploadProductImageUseCase`**
  - Reçoit un fichier (multipart)
  - Délègue au `StorageModule` (upload vers dossier `products/`)
  - Met à jour `product.imageUrl`
  - Retourne l'URL publique

---

## 7 · Présentation — Catégories (`/categories`)

### DTOs

- [ ] `CreateCategoryDto` : `name`, `description?`, `parentId?`
- [ ] `UpdateCategoryDto` : PartialType de CreateCategoryDto + `isActive?`
- [ ] `CategoryResponseDto` : tous les champs + `children?: CategoryResponseDto[]` (optionnel)

### Endpoints

- [ ] `GET /categories` — tous les rôles
  - Query : `isActive`
  - Retourne `CategoryResponseDto[]`

- [ ] `GET /categories/:id` — tous les rôles

- [ ] `POST /categories` — `@Roles(Admin, Manager)`

- [ ] `PATCH /categories/:id` — `@Roles(Admin, Manager)`

- [ ] `DELETE /categories/:id` — `@Roles(Admin)`

---

## 8 · Présentation — Produits (`/products`)

### DTOs

- [ ] `CreateProductDto`
  - `sku?: string`
  - `name: string`
  - `description?: string`
  - `type: ProductType`
  - `categoryId?: string` (IsUUID)
  - `unitPrice: number` (IsPositive)
  - `purchasePrice?: number`
  - `vatRate?: number` (défaut 20, IsIn([0, 5.5, 10, 20]))
  - `unit: ProductUnit`

- [ ] `UpdateProductDto` — PartialType + `isActive?`

- [ ] `ProductResponseDto`
  - Tous les champs + `category?: CategoryResponseDto`

- [ ] `ProductsPageDto`
  - `data: ProductResponseDto[]`, `total`, `page`, `limit`, `totalPages`

### Endpoints

- [ ] `GET /products` — tous les rôles
  - Query : `categoryId`, `type`, `isActive`, `search`, `page`, `limit`, `sortBy`, `sortOrder`
  - Retourne `ProductsPageDto`

- [ ] `GET /products/:id` — tous les rôles
  - Retourne `ProductResponseDto`

- [ ] `POST /products` — `@Roles(Admin, Manager)`
  - Retourne `ProductResponseDto` (201)

- [ ] `PATCH /products/:id` — `@Roles(Admin, Manager)`

- [ ] `DELETE /products/:id` — `@Roles(Admin)`

- [ ] `POST /products/:id/image` — `@Roles(Admin, Manager)`
  - `Content-Type: multipart/form-data`
  - Champ : `file` (jpeg/png, max 5 MB)
  - Retourne `{ imageUrl: string }`

---

## 9 · Règles métier

| Règle | Détail |
|-------|--------|
| SKU unique | Normalisé en majuscules, généré auto si absent |
| Type SERVICE | Pas de mouvement de stock généré (vérification dans modules 04 et 06) |
| Prix | Stocké en `decimal(12,2)`, toujours en EUR HT |
| Suppression | Bloquée si présent dans un devis ou une commande non clôturés |
| Image | Stockée via `StorageModule`, URL relative dans `imageUrl` |

---

## 10 · Actions Audit

| Action | Déclencheur |
|--------|-------------|
| `categories.created` | `CreateCategoryUseCase` |
| `categories.updated` | `UpdateCategoryUseCase` |
| `categories.deleted` | `DeleteCategoryUseCase` |
| `products.created` | `CreateProductUseCase` |
| `products.updated` | `UpdateProductUseCase` |
| `products.deleted` | `DeleteProductUseCase` |

---

## 11 · Tests

- [ ] **Unit** : `CreateProductUseCase` — SKU dupliqué → ConflictException
- [ ] **Unit** : `CreateProductUseCase` — auto-génération SKU
- [ ] **Unit** : `DeleteProductUseCase` — produit dans commande active → ConflictException
- [ ] **Unit** : `DeleteCategoryUseCase` — catégorie avec produits → ConflictException
- [ ] **Integration** : `TypeOrmProductRepository` — findAll avec filtre type + search
- [ ] **E2E** : cycle complet catégorie → produit → image upload → suppression
