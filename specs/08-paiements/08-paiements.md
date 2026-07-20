# 08 · Paiements & Suivi des Impayés

> **Dépendances** : `InvoicesModule`  
> **Modules réutilisés** : `Audit`, `MailModule`

---

## Contexte

Le module Paiements enregistre les encaissements reçus sur les factures. Un paiement est toujours lié à une facture. La mise à jour du statut de la facture (`PARTIALLY_PAID` / `PAID`) est gérée automatiquement lors de chaque enregistrement ou suppression de paiement.

---

## 1 · Domaine

- [ ] Créer `src/modules/payments/domain/payment-method.enum.ts`
  ```ts
  export enum PaymentMethod {
    BankTransfer = 'BANK_TRANSFER',
    Card         = 'CARD',
    Cash         = 'CASH',
    Check        = 'CHECK',
    Other        = 'OTHER',
  }
  ```

- [ ] Créer `src/modules/payments/domain/payment.ts`
  ```
  id          : string
  invoiceId   : string
  amount      : number         (positif, en EUR)
  method      : PaymentMethod
  reference   : string | null  (ex : numéro de virement, n° chèque)
  notes       : string | null
  paidAt      : Date
  recordedBy  : string         (userId)
  createdAt   : Date
  ```

- [ ] Créer `src/modules/payments/domain/payment-repository.port.ts`
  - `findAll(filters, pagination): Promise<{ payments: Payment[]; total: number }>`
  - `findById(id): Promise<Payment | null>`
  - `findByInvoice(invoiceId): Promise<Payment[]>`
  - `sumByInvoice(invoiceId): Promise<number>` (somme des montants)
  - `create(data): Promise<Payment>`
  - `delete(id): Promise<void>`

---

## 2 · Infrastructure

- [ ] Créer `TypeOrmPaymentEntity` (table `payments`)
  - `amount` : `decimal(12,2)`
  - `method` : enum
  - `paid_at` : timestamp
  - `invoice_id` : FK vers `invoices`
  - Index sur `invoice_id`, `paid_at`

- [ ] Créer migration `CreatePaymentsTable`

- [ ] Implémenter `TypeOrmPaymentRepository`

- [ ] Créer `PaymentMapper`

---

## 3 · Application — Use Cases

- [ ] **`ListPaymentsUseCase`**
  - Filtre : `invoiceId?`, `method?`, `from?`, `to?`
  - Pagination : `page`, `limit`, `sortBy` (défaut : `paidAt` DESC)

- [ ] **`GetPaymentByIdUseCase`**
  - Lève `ResourceNotFoundException`

- [ ] **`RecordPaymentUseCase`**
  1. Vérifie que la facture existe
  2. Vérifie que le statut de la facture est `SENT`, `OVERDUE` ou `PARTIALLY_PAID`
     - Si `PAID` ou `DRAFT` → `BusinessRuleException`
  3. Vérifie que `amount > 0`
  4. Vérifie que `amount <= invoice.remainingAmount`
     - Si dépassement → `BusinessRuleException` ("Montant dépasse le solde restant de X€")
  5. Crée le paiement
  6. Recalcule `invoice.paidAmount = sumByInvoice(invoiceId)`
  7. Met à jour le statut de la facture :
     - `paidAmount >= totalTTC` → `PAID` → envoie email de confirmation au client
     - Sinon → `PARTIALLY_PAID`
  8. Logge `payments.recorded`
  9. Si `PAID` : logge `invoices.paid`

- [ ] **`DeletePaymentUseCase`**
  - `@Roles(Admin)` uniquement
  - Supprime le paiement
  - Recalcule `invoice.paidAmount = sumByInvoice(invoiceId)`
  - Remet le statut de la facture à `SENT` ou `PARTIALLY_PAID` ou `OVERDUE` selon `paidAmount` et `dueDate`
  - Logge `payments.deleted`

- [ ] **`GetOverdueSummaryUseCase`**
  - Retourne la liste des factures `OVERDUE` + `PARTIALLY_PAID` avec :
    - Informations client
    - `totalTTC`, `paidAmount`, `remainingAmount`
    - `dueDate` et nombre de jours de retard
    - Liste des paiements reçus pour chaque facture
  - Triée par `remainingAmount` décroissant

---

## 4 · Présentation (`/payments`)

### DTOs

- [ ] `RecordPaymentDto`
  - `invoiceId: string` (IsUUID)
  - `amount: number` (IsPositive)
  - `method: PaymentMethod` (IsEnum)
  - `reference?: string`
  - `notes?: string`
  - `paidAt?: Date` (défaut : maintenant)

- [ ] `PaymentResponseDto`
  - `id`, `invoiceId`, `amount`, `method`, `reference`, `notes`, `paidAt`, `recordedBy`, `createdAt`

- [ ] `PaymentsPageDto`

- [ ] `OverdueInvoiceSummaryDto`
  - `invoiceId`, `invoiceNumber`, `customer: { id, companyName, email }`
  - `totalTTC`, `paidAmount`, `remainingAmount`
  - `dueDate`, `daysOverdue`
  - `payments: PaymentResponseDto[]`

- [ ] `OverdueSummaryPageDto`

### Endpoints

- [ ] `GET /payments` — `@Roles(Admin, Manager)`
  - Query : `invoiceId`, `method`, `from`, `to`, `page`, `limit`
  - Retourne `PaymentsPageDto`

- [ ] `GET /payments/:id` — `@Roles(Admin, Manager)`
  - Retourne `PaymentResponseDto`

- [ ] `POST /payments` — `@Roles(Admin, Manager)`
  - Body : `RecordPaymentDto`
  - Retourne `PaymentResponseDto` (201)

- [ ] `DELETE /payments/:id` — `@Roles(Admin)`
  - 204

- [ ] `GET /payments/overdue` — `@Roles(Admin, Manager)`
  - Résumé des impayés et paiements partiels
  - Retourne `OverdueSummaryPageDto`

---

## 5 · Règles métier

| Règle | Détail |
|-------|--------|
| Factures éligibles | Uniquement SENT, OVERDUE, PARTIALLY_PAID |
| Montant | Toujours positif, ne peut pas dépasser `remainingAmount` |
| Statut facture | Recalculé automatiquement après chaque ajout/suppression de paiement |
| Suppression paiement | ADMIN uniquement — le statut de la facture est recorrigé |
| Email | Envoyé au client lors du passage en statut PAID |
| Paiements multiples | Possibles sur la même facture (paiements partiels successifs) |

---

## 6 · Actions Audit

| Action | Déclencheur |
|--------|-------------|
| `payments.recorded` | `RecordPaymentUseCase` |
| `payments.deleted` | `DeletePaymentUseCase` |
| `invoices.paid` | `RecordPaymentUseCase` (si facture soldée) |

---

## 7 · Tests

- [ ] **Unit** : `RecordPaymentUseCase` — facture PAID → exception
- [ ] **Unit** : `RecordPaymentUseCase` — montant > remainingAmount → exception
- [ ] **Unit** : `RecordPaymentUseCase` — paiement partiel → statut PARTIALLY_PAID
- [ ] **Unit** : `RecordPaymentUseCase` — paiement soldant → statut PAID + email envoyé
- [ ] **Unit** : `DeletePaymentUseCase` — recalcul statut après suppression
- [ ] **Unit** : `GetOverdueSummaryUseCase` — tri + calcul jours de retard
- [ ] **E2E** : flux paiement partiel + paiement solde → facture PAID
- [ ] **E2E** : `GET /payments/overdue` retourne les bons agrégats
