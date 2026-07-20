# 04 · Gestion des Stocks

> **Dépendances** : `CatalogueModule` (products)  
> **Modules réutilisés** : `Audit`

---

## Contexte

Modèle multi-entrepôts. Chaque produit de type `PRODUCT` (pas `SERVICE`) peut avoir un niveau de stock dans chacun des entrepôts actifs. Les mouvements sont la source de vérité ; les niveaux de stock sont maintenus en temps réel lors de chaque mouvement.

---

## 1 · Domaine — Entrepôts

- [ ] Créer `src/modules/stock/domain/warehouse.ts`
  ```
  id        : string
  name      : string
  code      : string   (unique, ex : WH-PARIS)
  street    : string | null
  city      : string | null
  isActive  : boolean
  createdAt : Date
  updatedAt : Date
  ```

- [ ] Créer `src/modules/stock/domain/warehouse-repository.port.ts`
  - `findAll(filters): Promise<Warehouse[]>`
  - `findById(id): Promise<Warehouse | null>`
  - `findByCode(code): Promise<Warehouse | null>`
  - `create(data): Promise<Warehouse>`
  - `update(id, data): Promise<Warehouse>`
  - `deactivate(id): Promise<void>`
  - `hasMouvements(id): Promise<boolean>`

---

## 2 · Domaine — Niveaux de stock

- [ ] Créer `src/modules/stock/domain/stock-level.ts`
  ```
  productId   : string
  warehouseId : string
  quantity    : number   (jamais négatif)
  updatedAt   : Date
  ```

- [ ] Créer `src/modules/stock/domain/stock-level-repository.port.ts`
  - `findByProduct(productId): Promise<StockLevel[]>`
  - `findByWarehouse(warehouseId): Promise<StockLevel[]>`
  - `findAll(filters): Promise<StockLevel[]>` (filtre lowStock, productId, warehouseId)
  - `findOne(productId, warehouseId): Promise<StockLevel | null>`
  - `upsert(data): Promise<StockLevel>` (crée ou met à jour)

---

## 3 · Domaine — Mouvements de stock

- [ ] Créer `src/modules/stock/domain/stock-movement-type.enum.ts`
  ```ts
  export enum StockMovementType {
    In         = 'IN',          // réception / achat
    Out        = 'OUT',         // vente / consommation
    Adjustment = 'ADJUSTMENT',  // correction d'inventaire
    Transfer   = 'TRANSFER',    // mouvement interne entre entrepôts
  }
  ```

- [ ] Créer `src/modules/stock/domain/stock-movement.ts`
  ```
  id              : string
  productId       : string
  warehouseId     : string         (entrepôt source)
  targetWarehouseId : string | null (entrepôt cible pour TRANSFER)
  type            : StockMovementType
  quantity        : number         (toujours positif)
  unitCost        : number | null  (pour les IN depuis commandes fournisseur)
  reference       : string | null  (ex : numéro de commande)
  notes           : string | null
  performedBy     : string         (userId)
  performedAt     : Date
  createdAt       : Date
  ```

- [ ] Créer `src/modules/stock/domain/stock-movement-repository.port.ts`
  - `findAll(filters, pagination): Promise<{ movements: StockMovement[]; total: number }>`
  - `create(data): Promise<StockMovement>`

---

## 4 · Infrastructure

### Entrepôts

- [ ] Créer `TypeOrmWarehouseEntity` (table `warehouses`)
  - `code` : varchar unique
  - `@DeleteDateColumn()` — soft-delete

- [ ] Créer migration `CreateWarehousesTable`

- [ ] Implémenter `TypeOrmWarehouseRepository` + `WarehouseMapper`

### Niveaux de stock

- [ ] Créer `TypeOrmStockLevelEntity` (table `stock_levels`)
  - Clé primaire composite : `(product_id, warehouse_id)`
  - Contrainte `CHECK (quantity >= 0)`
  - Index sur `quantity` (pour requêtes low-stock)

- [ ] Créer migration `CreateStockLevelsTable`

- [ ] Implémenter `TypeOrmStockLevelRepository` + `StockLevelMapper`

### Mouvements de stock

- [ ] Créer `TypeOrmStockMovementEntity` (table `stock_movements`)
  - Index sur `product_id`, `warehouse_id`, `type`, `performed_at`

- [ ] Créer migration `CreateStockMovementsTable`

- [ ] Implémenter `TypeOrmStockMovementRepository` + `StockMovementMapper`

---

## 5 · Application — Use Cases Entrepôts

- [ ] **`ListWarehousesUseCase`**
  - Filtre : `isActive?`

- [ ] **`GetWarehouseByIdUseCase`**

- [ ] **`CreateWarehouseUseCase`**
  - Vérifie unicité du code (normalisé en majuscules)
  - Logge `warehouses.created`

- [ ] **`UpdateWarehouseUseCase`**
  - Logge `warehouses.updated`

- [ ] **`DeactivateWarehouseUseCase`**
  - Vérifie que le stock total de l'entrepôt est à 0
  - Sinon → `ConflictException` ("Entrepôt non vide")
  - Logge `warehouses.deactivated`

---

## 6 · Application — Use Cases Stock

- [ ] **`GetStockLevelsUseCase`**
  - Filtre : `warehouseId?`, `productId?`, `lowStock?` (qty < seuil, défaut 5)
  - Joint avec `Product` et `Warehouse` pour enrichir la réponse
  - Pagination

- [ ] **`RecordStockInUseCase`**
  - Vérifie que le produit est de type `PRODUCT`
  - Vérifie que l'entrepôt existe et est actif
  - Crée un `StockMovement` de type `IN`
  - `upsert` du `StockLevel` (qty += mouvement.quantity)
  - Logge `stock.in`

- [ ] **`RecordStockOutUseCase`**
  - Vérifie que le niveau de stock actuel est suffisant
  - Si insuffisant → `BusinessRuleException` ("Stock insuffisant : X disponible, Y demandé")
  - Crée un `StockMovement` de type `OUT`
  - `upsert` du `StockLevel` (qty -= mouvement.quantity)
  - Logge `stock.out`

- [ ] **`TransferStockUseCase`**
  - Vérifie source ≠ cible
  - Vérifie stock suffisant dans l'entrepôt source
  - Dans une **transaction** :
    - `StockMovement` type `TRANSFER` dans entrepôt source (qty -= X)
    - `StockMovement` type `IN` dans entrepôt cible (qty += X)
    - Mise à jour des deux `StockLevel`
  - Logge `stock.transfer`

- [ ] **`AdjustStockUseCase`**
  - `quantity` peut être positif ou négatif
  - Si ajustement négatif : vérifie que le niveau ne passerait pas en dessous de 0
  - Crée un `StockMovement` de type `ADJUSTMENT` avec la valeur absolue de l'écart
  - Met à jour `StockLevel`
  - Logge `stock.adjusted`

- [ ] **`ListStockMovementsUseCase`**
  - Filtre : `warehouseId?`, `productId?`, `type?`, `from?`, `to?`
  - Pagination
  - Retourne les mouvements avec détails produit + entrepôt

---

## 7 · Présentation — Entrepôts (`/warehouses`)

### DTOs

- [ ] `CreateWarehouseDto` : `name`, `code`, `street?`, `city?`
- [ ] `UpdateWarehouseDto` : PartialType + `isActive?`
- [ ] `WarehouseResponseDto` : tous les champs

### Endpoints

- [ ] `GET /warehouses` — tous les rôles
- [ ] `GET /warehouses/:id` — tous les rôles
- [ ] `POST /warehouses` — `@Roles(Admin)`
- [ ] `PATCH /warehouses/:id` — `@Roles(Admin, Manager)`
- [ ] `DELETE /warehouses/:id` — `@Roles(Admin)` (déactivation, pas suppression physique)

---

## 8 · Présentation — Stock (`/stock`)

### DTOs

- [ ] `StockLevelResponseDto` : `productId`, `productName`, `productSku`, `warehouseId`, `warehouseName`, `quantity`
- [ ] `StockLevelsPageDto`
- [ ] `RecordStockInDto` : `productId`, `warehouseId`, `quantity`, `unitCost?`, `reference?`, `notes?`
- [ ] `RecordStockOutDto` : `productId`, `warehouseId`, `quantity`, `reference?`, `notes?`
- [ ] `TransferStockDto` : `productId`, `fromWarehouseId`, `toWarehouseId`, `quantity`, `notes?`
- [ ] `AdjustStockDto` : `productId`, `warehouseId`, `newQuantity`, `notes` (obligatoire pour traçabilité)
- [ ] `StockMovementResponseDto` : tous les champs + détails produit + entrepôt
- [ ] `StockMovementsPageDto`

### Endpoints

- [ ] `GET /stock` — tous les rôles
  - Query : `warehouseId`, `productId`, `lowStock` (boolean), `page`, `limit`
  - Retourne `StockLevelsPageDto`

- [ ] `GET /stock/:productId` — tous les rôles
  - Niveaux dans tous les entrepôts pour un produit donné
  - Retourne `StockLevelResponseDto[]`

- [ ] `GET /stock/movements` — `@Roles(Admin, Manager)`
  - Query : `warehouseId`, `productId`, `type`, `from`, `to`, `page`, `limit`
  - Retourne `StockMovementsPageDto`

- [ ] `POST /stock/in` — `@Roles(Admin, Manager, Employee)`
  - Body : `RecordStockInDto`
  - Retourne `StockMovementResponseDto` (201)

- [ ] `POST /stock/out` — `@Roles(Admin, Manager, Employee)`
  - Body : `RecordStockOutDto`
  - Retourne `StockMovementResponseDto` (201)

- [ ] `POST /stock/transfer` — `@Roles(Admin, Manager)`
  - Body : `TransferStockDto`
  - Retourne `{ from: StockLevelResponseDto; to: StockLevelResponseDto }`

- [ ] `POST /stock/adjust` — `@Roles(Admin, Manager)`
  - Body : `AdjustStockDto`
  - Retourne `StockMovementResponseDto` (201)

---

## 9 · Règles métier

| Règle | Détail |
|-------|--------|
| Quantité positive | `quantity` dans les DTOs toujours > 0 (la direction est portée par le type) |
| Stock négatif impossible | Contrainte DB + vérification en use case avant écriture |
| Services ignorés | `RecordStockIn/Out` refusent les produits de type `SERVICE` |
| Atomicité Transfer | Transaction base de données : les deux mouvements échouent ou réussissent ensemble |
| Ajustement | `notes` obligatoire pour la traçabilité d'inventaire |

---

## 10 · Actions Audit

| Action | Déclencheur |
|--------|-------------|
| `warehouses.created` | `CreateWarehouseUseCase` |
| `warehouses.updated` | `UpdateWarehouseUseCase` |
| `warehouses.deactivated` | `DeactivateWarehouseUseCase` |
| `stock.in` | `RecordStockInUseCase` |
| `stock.out` | `RecordStockOutUseCase` |
| `stock.transfer` | `TransferStockUseCase` |
| `stock.adjusted` | `AdjustStockUseCase` |

---

## 11 · Tests

- [ ] **Unit** : `RecordStockOutUseCase` — stock insuffisant → BusinessRuleException
- [ ] **Unit** : `TransferStockUseCase` — atomicité (mock transaction)
- [ ] **Unit** : `AdjustStockUseCase` — ajustement négatif trop grand → exception
- [ ] **Unit** : `DeactivateWarehouseUseCase` — stock non vide → ConflictException
- [ ] **Integration** : `TypeOrmStockLevelRepository` — upsert correct (create + update)
- [ ] **E2E** : entrée stock → transfert → sortie → vérification niveaux
