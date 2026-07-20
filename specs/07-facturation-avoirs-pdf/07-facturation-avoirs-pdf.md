# 07 · Facturation, Avoirs & PDF

> **Dépendances** : `ContactsModule`, `CatalogueModule`, `OrdersModule`  
> **Modules réutilisés** : `Audit`, `PdfModule`, `MailModule`, `StorageModule`

---

## Contexte

Une facture est généralement créée depuis une commande client livrée (via `ConvertOrderToInvoiceUseCase`), mais peut aussi être créée manuellement. Un avoir est une facture de type `CREDIT_NOTE` qui annule totalement ou partiellement une facture existante.

---

## 1 · Domaine

### Enums

- [ ] Créer `src/modules/invoices/domain/invoice-type.enum.ts`
  ```ts
  export enum InvoiceType {
    Invoice    = 'INVOICE',
    CreditNote = 'CREDIT_NOTE',
  }
  ```

- [ ] Créer `src/modules/invoices/domain/invoice-status.enum.ts`
  ```ts
  export enum InvoiceStatus {
    Draft         = 'DRAFT',
    Sent          = 'SENT',
    PartiallyPaid = 'PARTIALLY_PAID',
    Paid          = 'PAID',
    Overdue       = 'OVERDUE',
    Cancelled     = 'CANCELLED',
  }
  ```

### Entité `InvoiceLine`

- [ ] Créer `src/modules/invoices/domain/invoice-line.ts`
  ```
  id          : string
  invoiceId   : string
  productId   : string | null
  description : string
  quantity    : number
  unitPrice   : number          (HT)
  vatRate     : number
  subtotalHT  : number          (calculé)
  ```

### Entité `Invoice`

- [ ] Créer `src/modules/invoices/domain/invoice.ts`
  ```
  id               : string
  number           : string          (auto : FAC-YYYY-NNNN ou AV-YYYY-NNNN)
  type             : InvoiceType
  customerId       : string
  orderId          : string | null
  status           : InvoiceStatus
  issueDate        : Date
  dueDate          : Date
  totalHT          : number
  totalVAT         : number
  totalTTC         : number
  paidAmount       : number          (mis à jour par le module Paiements)
  creditNoteForId  : string | null   (ID de la facture annulée par cet avoir)
  pdfUrl           : string | null   (URL du PDF stocké)
  notes            : string | null
  createdBy        : string
  createdAt        : Date
  updatedAt        : Date
  lines            : InvoiceLine[]
  ```

- [ ] Ajouter propriété calculée `remainingAmount = totalTTC - paidAmount` sur `Invoice`

- [ ] Ajouter méthode `calculateTotals()` sur `Invoice`

- [ ] Créer `src/modules/invoices/domain/invoice-repository.port.ts`
  - `findAll(filters, pagination): Promise<{ invoices: Invoice[]; total: number }>`
  - `findById(id): Promise<Invoice | null>`
  - `findOverdue(): Promise<Invoice[]>` (SENT/PARTIALLY_PAID + dueDate < now)
  - `findByCustomer(customerId): Promise<Invoice[]>`
  - `create(data): Promise<Invoice>`
  - `update(id, data): Promise<Invoice>`
  - `delete(id): Promise<void>`
  - `nextNumber(type): Promise<string>`

---

## 2 · Infrastructure

- [ ] Créer `TypeOrmInvoiceEntity` (table `invoices`)
  - `number` : varchar unique
  - `type` : enum
  - `status` : enum
  - `total_ht`, `total_vat`, `total_ttc`, `paid_amount` : `decimal(12,2)`
  - `credit_note_for_id` : FK nullable vers `invoices` (auto-référence)
  - `order_id` : FK nullable vers `orders`
  - Index sur `customer_id`, `status`, `due_date`, `created_at`

- [ ] Créer `TypeOrmInvoiceLineEntity` (table `invoice_lines`)
  - `@ManyToOne(() => TypeOrmInvoiceEntity, { onDelete: 'CASCADE' })`

- [ ] Créer migration `CreateInvoicesTable`
- [ ] Créer migration `CreateInvoiceLinesTable`

- [ ] Implémenter `TypeOrmInvoiceRepository`
- [ ] Créer `InvoiceMapper`, `InvoiceLineMapper`

---

## 3 · Application — Use Cases

- [ ] **`ListInvoicesUseCase`**
  - Filtre : `type?`, `status?`, `customerId?`, `from?`, `to?`
  - Pagination

- [ ] **`GetInvoiceByIdUseCase`**
  - Inclut lignes + contact
  - Lève `ResourceNotFoundException`

- [ ] **`CreateInvoiceUseCase`**
  - Vérifie que le contact est de type CUSTOMER ou BOTH
  - `dueDate` défaut : `issueDate + 30 jours`
  - Calcule les totaux
  - `paidAmount` initial : 0
  - Génère le numéro
  - Status initial : `DRAFT`
  - Logge `invoices.created`

- [ ] **`UpdateInvoiceUseCase`**
  - Uniquement en statut `DRAFT`
  - Recalcule totaux
  - Logge `invoices.updated`

- [ ] **`DeleteInvoiceUseCase`**
  - Uniquement en statut `DRAFT`
  - Logge `invoices.deleted`

- [ ] **`SendInvoiceUseCase`**
  - Transition : `DRAFT` → `SENT`
  - Génère le PDF via `GenerateInvoicePdfUseCase`
  - Stocke le PDF via `StorageModule` → renseigne `pdfUrl`
  - Envoie l'email au client avec le PDF en pièce jointe (si email renseigné)
  - Logge `invoices.sent`

- [ ] **`CancelInvoiceUseCase`**
  - Autorisé si statut `DRAFT` ou `SENT` (pas si `PAID` ou `PARTIALLY_PAID`)
  - Si `PARTIALLY_PAID` : refus (créer un avoir à la place)
  - Logge `invoices.cancelled`

- [ ] **`CreateCreditNoteUseCase`**
  - Paramètre : `invoiceId` (facture source), `amount?` (si avoir partiel), `lines?`
  - La facture source doit être `SENT`, `PARTIALLY_PAID` ou `PAID`
  - Crée une `Invoice` de type `CREDIT_NOTE` avec `creditNoteForId = invoiceId`
  - Numérotation : `AV-YYYY-NNNN`
  - Lignes : copiées de la facture source si non fournies
  - Montants négatifs (ou logique selon convention)
  - Logge `invoices.credit_note_created`

- [ ] **`GenerateInvoicePdfUseCase`**
  - Compile template Handlebars avec les données de la facture
  - Retourne `Buffer` PDF via `PdfModule`

- [ ] **`CheckOverdueInvoicesUseCase`** *(tâche planifiée)*
  - Récupère toutes les factures `SENT` ou `PARTIALLY_PAID` avec `dueDate < now`
  - Passe en `OVERDUE`
  - Logge `invoices.overdue` pour chaque facture

---

## 4 · Templates PDF

- [ ] Créer `src/modules/invoices/infrastructure/templates/invoice.hbs`
  - En-tête : logo, nom/adresse société émettrice
  - Section client : nom, adresse, SIRET, n° TVA
  - Références : numéro facture, date d'émission, date d'échéance, numéro commande lié
  - Tableau des lignes : description, qté, unité, prix unit HT, TVA %, sous-total HT
  - Récapitulatif TVA par taux
  - Totaux : total HT, TVA 20%, total TTC, montant déjà payé, reste à payer
  - Coordonnées bancaires (IBAN, BIC — depuis config)
  - Mentions légales (pénalités de retard, escompte)

- [ ] Créer `src/modules/invoices/infrastructure/templates/credit-note.hbs`
  - Similaire à invoice.hbs avec mention "AVOIR" + référence à la facture d'origine

---

## 5 · Présentation (`/invoices`)

### DTOs

- [ ] `InvoiceLineInputDto`
  - `productId?: string`
  - `description: string`
  - `quantity: number`
  - `unitPrice: number`
  - `vatRate?: number`

- [ ] `CreateInvoiceDto`
  - `customerId: string`
  - `orderId?: string`
  - `dueDate?: Date`
  - `notes?: string`
  - `lines: InvoiceLineInputDto[]` (ArrayMinSize 1)

- [ ] `UpdateInvoiceDto` — PartialType

- [ ] `CreateCreditNoteDto`
  - `lines?: InvoiceLineInputDto[]` (si vide : copie la facture source)
  - `notes?: string`

- [ ] `InvoiceLineResponseDto`

- [ ] `InvoiceResponseDto`
  - `id`, `number`, `type`, `status`
  - `customer: ContactResponseDto`
  - `orderId`
  - `issueDate`, `dueDate`
  - `lines: InvoiceLineResponseDto[]`
  - `totalHT`, `totalVAT`, `totalTTC`, `paidAmount`, `remainingAmount`
  - `creditNoteForId`, `pdfUrl`
  - `createdBy`, `createdAt`, `updatedAt`

- [ ] `InvoicesPageDto`

### Endpoints

- [ ] `GET /invoices` — tous les rôles
  - Query : `type`, `status`, `customerId`, `from`, `to`, `page`, `limit`, `sortBy`, `sortOrder`

- [ ] `GET /invoices/:id` — tous les rôles

- [ ] `POST /invoices` — `@Roles(Admin, Manager)`
  - Retourne `InvoiceResponseDto` (201)

- [ ] `PATCH /invoices/:id` — `@Roles(Admin, Manager)` (DRAFT uniquement)

- [ ] `DELETE /invoices/:id` — `@Roles(Admin)` (DRAFT uniquement, 204)

- [ ] `POST /invoices/:id/send` — `@Roles(Admin, Manager)`

- [ ] `POST /invoices/:id/cancel` — `@Roles(Admin, Manager)`

- [ ] `POST /invoices/:id/credit-note` — `@Roles(Admin, Manager)`
  - Body : `CreateCreditNoteDto`
  - Retourne `InvoiceResponseDto` du nouvel avoir (201)

- [ ] `GET /invoices/:id/pdf` — tous les rôles
  - Header : `Content-Type: application/pdf`
  - Header : `Content-Disposition: attachment; filename="FAC-YYYY-NNNN.pdf"`

---

## 6 · Tâche planifiée

- [ ] Ajouter `CheckOverdueInvoicesJob` dans `SchedulerModule`
  - Cron : tous les jours à 02:00
  - Appelle `CheckOverdueInvoicesUseCase`

---

## 7 · Configuration

- [ ] Ajouter dans la config app les champs pour le template PDF :
  - `company.name`, `company.address`, `company.siret`, `company.vatNumber`
  - `company.iban`, `company.bic`
  - `company.logo` (chemin relatif)
  - `invoice.latePaymentPenalty` (ex : "3x le taux légal")
  - `invoice.defaultPaymentTermDays` (défaut : 30)

---

## 8 · Règles métier

| Règle | Détail |
|-------|--------|
| Transitions | DRAFT→SENT→(PARTIALLY_PAID ou PAID ou OVERDUE ou CANCELLED) |
| Annulation | Impossible si PAID ou PARTIALLY_PAID (créer un avoir) |
| Avoir | Lie la facture source via `creditNoteForId`, numérotation AV-YYYY-NNNN |
| PDF | Généré et stocké lors de l'envoi, téléchargeable à tout moment |
| Email | Envoyé avec PDF en pièce jointe si email client renseigné |
| `paidAmount` | Mis à jour exclusivement par le module Paiements (module 08) |

---

## 9 · Actions Audit

| Action | Déclencheur |
|--------|-------------|
| `invoices.created` | `CreateInvoiceUseCase` |
| `invoices.updated` | `UpdateInvoiceUseCase` |
| `invoices.sent` | `SendInvoiceUseCase` |
| `invoices.cancelled` | `CancelInvoiceUseCase` |
| `invoices.credit_note_created` | `CreateCreditNoteUseCase` |
| `invoices.overdue` | `CheckOverdueInvoicesUseCase` |
| `invoices.deleted` | `DeleteInvoiceUseCase` |

---

## 10 · Tests

- [ ] **Unit** : `CreateCreditNoteUseCase` — facture DRAFT → exception
- [ ] **Unit** : `CancelInvoiceUseCase` — facture PAID → exception
- [ ] **Unit** : `SendInvoiceUseCase` — génère PDF + email (mock modules)
- [ ] **Unit** : `CheckOverdueInvoicesUseCase` — passe correctement en OVERDUE
- [ ] **Unit** : `calculateTotals()` — cohérence totalHT + TVA = TTC
- [ ] **E2E** : DRAFT → SENT → vérifier pdfUrl renseigné
- [ ] **E2E** : créer avoir depuis facture SENT
