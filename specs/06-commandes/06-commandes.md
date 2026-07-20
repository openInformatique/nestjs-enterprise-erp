# 06 · Commandes — Clients & Fournisseurs

> **Dépendances** : `ContactsModule`, `CatalogueModule`, `StockModule`, `QuotesModule`  
> **Modules réutilisés** : `Audit`

---

## Contexte

Deux types de commandes dans un même module :
- **CUSTOMER** : commande passée par un client. Déclenche une sortie de stock à la livraison.
- **SUPPLIER** : commande passée à un fournisseur. Déclenche une entrée de stock à la réception.

Une commande peut être créée manuellement ou être le résultat de la conversion d'un devis accepté.

---

## 1 · Domaine

### Enums

- [ ] Créer `src/modules/orders/domain/order-type.enum.ts`
  ```ts
  export enum OrderType {
    Customer = 'CUSTOMER',
    Supplier = 'SUPPLIER',
  }
  ```

- [ ] Créer `src/modules/orders/domain/order-status.enum.ts`
  ```ts
  export enum OrderStatus {
    Draft      = 'DRAFT',
    Confirmed  = 'CONFIRMED',
    InProgress = 'IN_PROGRESS',
    Delivered  = 'DELIVERED',
    Cancelled  = 'CANCELLED',
  }
  ```

### Entité `OrderLine`

- [ ] Créer `src/modules/orders/domain/order-line.ts`
  ```
  id          : string
  orderId     : string
  productId   : string | null
  description : string
  quantity    : number
  unitPrice   : number          (HT)
  vatRate     : number
  subtotalHT  : number          (calculé)
  ```

### Entité `Order`

- [ ] Créer `src/modules/orders/domain/order.ts`
  ```
  id                   : string
  number               : string          (auto : CMD-YYYY-NNNN)
  type                 : OrderType
  contactId            : string
  status               : OrderStatus
  quoteId              : string | null   (si converti depuis devis)
  notes                : string | null
  totalHT              : number
  totalVAT             : number
  totalTTC             : number
  expectedDeliveryDate : Date | null
  deliveredAt          : Date | null
  createdBy            : string
  createdAt            : Date
  updatedAt            : Date
  lines                : OrderLine[]
  ```

- [ ] Ajouter méthode `calculateTotals()` sur `Order`

- [ ] Créer `src/modules/orders/domain/order-repository.port.ts`
  - `findAll(filters, pagination): Promise<{ orders: Order[]; total: number }>`
  - `findById(id): Promise<Order | null>`
  - `findActiveByContact(contactId): Promise<Order[]>`
  - `findActiveByProduct(productId): Promise<Order[]>`
  - `create(data): Promise<Order>`
  - `update(id, data): Promise<Order>`
  - `delete(id): Promise<void>`
  - `nextNumber(type): Promise<string>`

---

## 2 · Infrastructure

- [ ] Créer `TypeOrmOrderEntity` (table `orders`)
  - `number` : varchar unique
  - `type` : enum
  - `status` : enum
  - `total_ht`, `total_vat`, `total_ttc` : `decimal(12,2)`
  - `quote_id` : FK nullable vers `quotes`
  - Index sur `contact_id`, `type`, `status`, `created_at`

- [ ] Créer `TypeOrmOrderLineEntity` (table `order_lines`)
  - `@ManyToOne(() => TypeOrmOrderEntity, { onDelete: 'CASCADE' })`

- [ ] Créer migration `CreateOrdersTable`
- [ ] Créer migration `CreateOrderLinesTable`

- [ ] Implémenter `TypeOrmOrderRepository`
- [ ] Créer `OrderMapper`, `OrderLineMapper`

---

## 3 · Application — Use Cases

- [ ] **`ListOrdersUseCase`**
  - Filtre : `type?`, `status?`, `contactId?`, `from?`, `to?`
  - Pagination : `page`, `limit`, `sortBy`, `sortOrder`

- [ ] **`GetOrderByIdUseCase`**
  - Inclut lignes + contact
  - Lève `ResourceNotFoundException`

- [ ] **`CreateOrderUseCase`**
  - Vérifie que le contact correspond au type (CUSTOMER ↔ CUSTOMER/BOTH ; SUPPLIER ↔ SUPPLIER/BOTH)
  - Calcule les totaux
  - Génère le numéro (`CMD-YYYY-NNNN` pour client, `CDF-YYYY-NNNN` pour fournisseur)
  - Status initial : `DRAFT`
  - Logge `orders.created`

- [ ] **`UpdateOrderUseCase`**
  - Autorisé uniquement si `DRAFT` ou `CONFIRMED`
  - Recalcule les totaux
  - Logge `orders.updated`

- [ ] **`DeleteOrderUseCase`**
  - Autorisé uniquement si `DRAFT`
  - Logge `orders.deleted`

- [ ] **`ConfirmOrderUseCase`**
  - Transition : `DRAFT` → `CONFIRMED`
  - Logge `orders.confirmed`

- [ ] **`StartDeliveryUseCase`**
  - Transition : `CONFIRMED` → `IN_PROGRESS`
  - Pour les commandes **CUSTOMER** :
    - Pour chaque ligne avec `productId` et type `PRODUCT` :
      - Appelle `RecordStockOutUseCase` (entrepôt par défaut ou spécifié)
      - Si stock insuffisant → exception, transition annulée
  - Logge `orders.started`

- [ ] **`CompleteOrderUseCase`**
  - Transition : `IN_PROGRESS` → `DELIVERED`
  - Pose `deliveredAt = now`
  - Pour les commandes **SUPPLIER** :
    - Pour chaque ligne avec `productId` et type `PRODUCT` :
      - Appelle `RecordStockInUseCase`
  - Logge `orders.delivered`

- [ ] **`CancelOrderUseCase`**
  - Autorisé depuis n'importe quel statut sauf `DELIVERED`
  - Si status était `IN_PROGRESS` (CUSTOMER) : reverse les sorties de stock (appelle `RecordStockInUseCase` avec référence "ANNULATION CMD-XXXX")
  - Logge `orders.cancelled`

- [ ] **`ConvertOrderToInvoiceUseCase`**
  - Uniquement pour commandes `CUSTOMER` en statut `DELIVERED`
  - Crée une `Invoice` (module 07) avec les mêmes lignes
  - Logge `orders.invoiced`

---

## 4 · Présentation (`/orders`)

### DTOs

- [ ] `OrderLineInputDto`
  - `productId?: string`
  - `description: string`
  - `quantity: number` (IsPositive)
  - `unitPrice: number` (IsPositive)
  - `vatRate?: number`

- [ ] `CreateOrderDto`
  - `type: OrderType`
  - `contactId: string`
  - `notes?: string`
  - `expectedDeliveryDate?: Date`
  - `lines: OrderLineInputDto[]` (ArrayMinSize 1)

- [ ] `UpdateOrderDto` — PartialType (sans `type`)

- [ ] `StartDeliveryDto` (optionnel)
  - `warehouseId?: string` (entrepôt depuis lequel sortir le stock)

- [ ] `OrderLineResponseDto`

- [ ] `OrderResponseDto`
  - `id`, `number`, `type`, `status`, `quoteId`
  - `contact: ContactResponseDto`
  - `lines: OrderLineResponseDto[]`
  - `totalHT`, `totalVAT`, `totalTTC`
  - `expectedDeliveryDate`, `deliveredAt`
  - `createdBy`, `createdAt`, `updatedAt`

- [ ] `OrdersPageDto`

### Endpoints

- [ ] `GET /orders` — tous les rôles
  - Query : `type`, `status`, `contactId`, `from`, `to`, `page`, `limit`, `sortBy`, `sortOrder`

- [ ] `GET /orders/:id` — tous les rôles

- [ ] `POST /orders` — `@Roles(Admin, Manager)`
  - Retourne `OrderResponseDto` (201)

- [ ] `PATCH /orders/:id` — `@Roles(Admin, Manager)`

- [ ] `DELETE /orders/:id` — `@Roles(Admin)` (DRAFT uniquement, 204)

- [ ] `POST /orders/:id/confirm` — `@Roles(Admin, Manager)`

- [ ] `POST /orders/:id/start` — `@Roles(Admin, Manager, Employee)`
  - Body optionnel : `StartDeliveryDto`

- [ ] `POST /orders/:id/complete` — `@Roles(Admin, Manager, Employee)`

- [ ] `POST /orders/:id/cancel` — `@Roles(Admin, Manager)`

- [ ] `POST /orders/:id/invoice` — `@Roles(Admin, Manager)`
  - Retourne `InvoiceResponseDto` (201) *(type depuis module 07)*

---

## 5 · Règles métier

| Règle | Détail |
|-------|--------|
| Transitions | DRAFT→CONFIRMED→IN_PROGRESS→DELIVERED, ou →CANCELLED depuis tout état sauf DELIVERED |
| Contact cohérent | CUSTOMER → contact CUSTOMER/BOTH ; SUPPLIER → contact SUPPLIER/BOTH |
| Stock (CUSTOMER) | Sorti lors de `StartDelivery`, réinjecté si `Cancel` depuis IN_PROGRESS |
| Stock (SUPPLIER) | Entré lors de `Complete`, aucun reverse en cas d'annulation |
| Numérotation | CMD-YYYY-NNNN (client) / CDF-YYYY-NNNN (fournisseur) |
| Facturation | Uniquement commandes CUSTOMER + status DELIVERED |
| Conversion devis | `quoteId` renseigné, lignes copiées du devis |

---

## 6 · Actions Audit

| Action | Déclencheur |
|--------|-------------|
| `orders.created` | `CreateOrderUseCase` |
| `orders.confirmed` | `ConfirmOrderUseCase` |
| `orders.started` | `StartDeliveryUseCase` |
| `orders.delivered` | `CompleteOrderUseCase` |
| `orders.cancelled` | `CancelOrderUseCase` |
| `orders.invoiced` | `ConvertOrderToInvoiceUseCase` |
| `orders.deleted` | `DeleteOrderUseCase` |

---

## 7 · Tests

- [ ] **Unit** : `StartDeliveryUseCase` — stock insuffisant → exception, stock inchangé
- [ ] **Unit** : `CancelOrderUseCase` depuis IN_PROGRESS → stock reversé
- [ ] **Unit** : `ConvertOrderToInvoiceUseCase` — commande SUPPLIER → exception
- [ ] **Unit** : `CreateOrderUseCase` — mauvais type de contact → exception
- [ ] **Integration** : `TypeOrmOrderRepository` — filtres type + status + contact
- [ ] **E2E** : flux CUSTOMER : DRAFT → CONFIRMED → IN_PROGRESS (stock out) → DELIVERED → invoice
- [ ] **E2E** : flux SUPPLIER : DRAFT → CONFIRMED → DELIVERED (stock in)
- [ ] **E2E** : annulation depuis IN_PROGRESS → stock reversé
