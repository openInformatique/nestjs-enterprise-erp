# 05 · Devis

> **Dépendances** : `ContactsModule` (clients), `CatalogueModule` (produits)  
> **Modules réutilisés** : `Audit`, `PdfModule`, `MailModule`

---

## Contexte

Un devis est établi pour un **client** (Contact de type CUSTOMER ou BOTH). Il comporte des lignes liées à des produits du catalogue ou décrites librement. Le devis suit un cycle de vie strict et peut être converti en commande une fois accepté.

---

## 1 · Domaine

### Enum statuts

- [ ] Créer `src/modules/quotes/domain/quote-status.enum.ts`
  ```ts
  export enum QuoteStatus {
    Draft    = 'DRAFT',
    Sent     = 'SENT',
    Accepted = 'ACCEPTED',
    Rejected = 'REJECTED',
    Expired  = 'EXPIRED',
  }
  ```

### Entité `QuoteLine`

- [ ] Créer `src/modules/quotes/domain/quote-line.ts`
  ```
  id              : string
  quoteId         : string
  productId       : string | null   (null = ligne libre)
  description     : string          (copie du nom produit ou texte libre)
  quantity        : number          (> 0)
  unitPrice       : number          (HT, en EUR)
  vatRate         : number          (défaut 20)
  discountPercent : number          (0–100, défaut 0)
  subtotalHT      : number          (calculé : qty × unitPrice × (1 - discount/100))
  ```

### Entité `Quote`

- [ ] Créer `src/modules/quotes/domain/quote.ts`
  ```
  id         : string
  number     : string          (auto : DEV-YYYY-NNNN)
  customerId : string
  status     : QuoteStatus
  validUntil : Date
  notes      : string | null
  totalHT    : number          (Σ subtotalHT)
  totalVAT   : number          (Σ subtotalHT × vatRate / 100)
  totalTTC   : number          (totalHT + totalVAT)
  createdBy  : string
  createdAt  : Date
  updatedAt  : Date
  lines      : QuoteLine[]
  ```

- [ ] Ajouter méthode de domaine `calculateTotals()` sur `Quote`
  - Recalcule `subtotalHT` de chaque ligne, puis `totalHT`, `totalVAT`, `totalTTC`

- [ ] Créer `src/modules/quotes/domain/quote-repository.port.ts`
  - `findAll(filters, pagination): Promise<{ quotes: Quote[]; total: number }>`
  - `findById(id): Promise<Quote | null>` (inclut les lignes)
  - `findExpired(): Promise<Quote[]>` (SENT + validUntil < now)
  - `create(data): Promise<Quote>`
  - `update(id, data): Promise<Quote>`
  - `delete(id): Promise<void>`
  - `nextNumber(): Promise<string>` (génère le prochain numéro DEV-YYYY-NNNN)

---

## 2 · Infrastructure

- [ ] Créer `TypeOrmQuoteEntity` (table `quotes`)
  - `number` : varchar unique
  - `status` : enum
  - `total_ht`, `total_vat`, `total_ttc` : `decimal(12,2)`
  - Index sur `customer_id`, `status`, `created_at`

- [ ] Créer `TypeOrmQuoteLineEntity` (table `quote_lines`)
  - `@ManyToOne(() => TypeOrmQuoteEntity, { onDelete: 'CASCADE' })`
  - `subtotal_ht` : `decimal(12,2)`

- [ ] Créer migration `CreateQuotesTable`
- [ ] Créer migration `CreateQuoteLinesTable`

- [ ] Implémenter `TypeOrmQuoteRepository`
  - `nextNumber()` : séquence basée sur COUNT de l'année courante + 1

- [ ] Créer `QuoteMapper`, `QuoteLineMapper`

---

## 3 · Application — Use Cases

- [ ] **`ListQuotesUseCase`**
  - Filtre : `status?`, `customerId?`, `from?`, `to?`
  - Pagination : `page`, `limit`, `sortBy`, `sortOrder`

- [ ] **`GetQuoteByIdUseCase`**
  - Inclut les lignes et le contact client
  - Lève `ResourceNotFoundException`

- [ ] **`CreateQuoteUseCase`**
  - Vérifie que le contact est de type CUSTOMER ou BOTH
  - Pour chaque ligne avec `productId` : vérifie que le produit existe et est actif, copie `description`, `unitPrice`, `vatRate` du produit si non fournis
  - Calcule les totaux via `calculateTotals()`
  - `validUntil` : si non fourni, défaut = aujourd'hui + 30 jours
  - Génère le numéro via `nextNumber()`
  - Status initial : `DRAFT`
  - Logge `quotes.created`

- [ ] **`UpdateQuoteUseCase`**
  - Autorisé uniquement si status = `DRAFT`
  - Sinon → `BusinessRuleException`
  - Recalcule les totaux après modification des lignes
  - Logge `quotes.updated`

- [ ] **`DeleteQuoteUseCase`**
  - Autorisé uniquement si status = `DRAFT`
  - Logge `quotes.deleted`

- [ ] **`SendQuoteUseCase`**
  - Transition : `DRAFT` → `SENT`
  - Génère le PDF via `GenerateQuotePdfUseCase`
  - Envoie l'email au client avec le PDF en pièce jointe via `MailModule`
  - Logge `quotes.sent`

- [ ] **`AcceptQuoteUseCase`**
  - Transition : `SENT` → `ACCEPTED`
  - Logge `quotes.accepted`

- [ ] **`RejectQuoteUseCase`**
  - Transition : `SENT` → `REJECTED`
  - Logge `quotes.rejected`

- [ ] **`ConvertQuoteToOrderUseCase`**
  - Transition : `ACCEPTED` → (le devis reste ACCEPTED, une Order est créée)
  - Copie les lignes du devis dans la commande
  - Retourne l'`Order` créée
  - Logge `quotes.converted`

- [ ] **`GenerateQuotePdfUseCase`**
  - Compile le template Handlebars avec les données du devis
  - Retourne un `Buffer` PDF via `PdfModule`

- [ ] **`ExpireQuotesUseCase`** *(tâche planifiée)*
  - Récupère tous les devis `SENT` avec `validUntil < now`
  - Les passe en `EXPIRED`
  - Logge `quotes.expired` pour chaque devis

---

## 4 · Template PDF

- [ ] Créer `src/modules/quotes/infrastructure/templates/quote.hbs`
  - En-tête : logo (configurable), nom société, adresse
  - Section client : nom, adresse, SIRET, n° TVA
  - Tableau des lignes : description, qté, prix unit HT, remise %, sous-total HT
  - Totaux : total HT, TVA 20%, total TTC
  - Conditions de validité
  - Mentions légales

---

## 5 · Présentation (`/quotes`)

### DTOs

- [ ] `QuoteLineInputDto`
  - `productId?: string` (IsUUID)
  - `description: string` (MaxLength 500)
  - `quantity: number` (IsPositive)
  - `unitPrice: number` (IsPositive)
  - `vatRate?: number` (défaut 20)
  - `discountPercent?: number` (Min 0, Max 100)

- [ ] `CreateQuoteDto`
  - `customerId: string` (IsUUID)
  - `validUntil?: Date`
  - `notes?: string`
  - `lines: QuoteLineInputDto[]` (ArrayMinSize 1)

- [ ] `UpdateQuoteDto` — PartialType de `CreateQuoteDto`

- [ ] `QuoteLineResponseDto`
  - `id`, `productId`, `description`, `quantity`, `unitPrice`, `vatRate`, `discountPercent`, `subtotalHT`

- [ ] `QuoteResponseDto`
  - `id`, `number`, `status`, `validUntil`, `notes`
  - `customer: ContactResponseDto`
  - `lines: QuoteLineResponseDto[]`
  - `totalHT`, `totalVAT`, `totalTTC`
  - `createdBy`, `createdAt`, `updatedAt`

- [ ] `QuotesPageDto`

### Endpoints

- [ ] `GET /quotes` — tous les rôles
  - Query : `status`, `customerId`, `from`, `to`, `page`, `limit`, `sortBy`, `sortOrder`

- [ ] `GET /quotes/:id` — tous les rôles

- [ ] `POST /quotes` — `@Roles(Admin, Manager, Employee)`
  - Retourne `QuoteResponseDto` (201)

- [ ] `PATCH /quotes/:id` — `@Roles(Admin, Manager)` (DRAFT uniquement)

- [ ] `DELETE /quotes/:id` — `@Roles(Admin)` (DRAFT uniquement, 204)

- [ ] `POST /quotes/:id/send` — `@Roles(Admin, Manager)`
  - Retourne `QuoteResponseDto`

- [ ] `POST /quotes/:id/accept` — `@Roles(Admin, Manager)`

- [ ] `POST /quotes/:id/reject` — `@Roles(Admin, Manager)`

- [ ] `POST /quotes/:id/convert` — `@Roles(Admin, Manager)`
  - Retourne `OrderResponseDto` (201) *(type depuis module 06)*

- [ ] `GET /quotes/:id/pdf` — tous les rôles
  - Header : `Content-Type: application/pdf`
  - Header : `Content-Disposition: attachment; filename="DEV-YYYY-NNNN.pdf"`

---

## 6 · Tâche planifiée

- [ ] Ajouter `ExpireQuotesJob` dans `SchedulerModule` (ou dans le module quotes)
  - Cron : tous les jours à 01:00
  - Appelle `ExpireQuotesUseCase`

---

## 7 · Règles métier

| Règle | Détail |
|-------|--------|
| Transitions valides | DRAFT→SENT, SENT→ACCEPTED, SENT→REJECTED, SENT→EXPIRED uniquement |
| Modification | Uniquement en statut DRAFT |
| Suppression | Uniquement en statut DRAFT |
| Contact | Doit être de type CUSTOMER ou BOTH |
| Ligne libre | productId optionnel : permet de facturer des articles hors catalogue |
| Numérotation | Séquentielle par année : DEV-2025-0001, DEV-2025-0002… |
| PDF | Généré à la volée, non stocké (peut être ajouté plus tard via StorageModule) |
| Email | Envoyé uniquement si l'email client est renseigné |

---

## 8 · Actions Audit

| Action | Déclencheur |
|--------|-------------|
| `quotes.created` | `CreateQuoteUseCase` |
| `quotes.updated` | `UpdateQuoteUseCase` |
| `quotes.sent` | `SendQuoteUseCase` |
| `quotes.accepted` | `AcceptQuoteUseCase` |
| `quotes.rejected` | `RejectQuoteUseCase` |
| `quotes.converted` | `ConvertQuoteToOrderUseCase` |
| `quotes.expired` | `ExpireQuotesUseCase` |
| `quotes.deleted` | `DeleteQuoteUseCase` |

---

## 9 · Tests

- [ ] **Unit** : `CreateQuoteUseCase` — calcul totaux avec remise
- [ ] **Unit** : `CreateQuoteUseCase` — contact de type SUPPLIER → exception
- [ ] **Unit** : `UpdateQuoteUseCase` — status != DRAFT → BusinessRuleException
- [ ] **Unit** : `SendQuoteUseCase` — transition DRAFT → SENT (mock PDF + mail)
- [ ] **Unit** : `SendQuoteUseCase` — status déjà SENT → exception
- [ ] **Unit** : `ExpireQuotesUseCase` — passe correctement en EXPIRED
- [ ] **Unit** : `calculateTotals()` — calcul correct avec TVA + remise
- [ ] **E2E** : flux complet DRAFT → SENT → ACCEPTED → convert → Order créée
