# 02 · Contacts — Clients & Fournisseurs

> **Dépendances** : `UsersModule` (rôles + audit actor)  
> **Modules réutilisés** : `Audit`

---

## Contexte

Une entité unique `Contact` couvre à la fois les clients et les fournisseurs. Un contact peut être des deux types (`BOTH`). Ce choix simplifie le modèle pour un ERP de démonstration tout en restant réaliste.

---

## 1 · Domaine

- [ ] Créer `src/modules/contacts/domain/contact-type.enum.ts`
  ```ts
  export enum ContactType {
    Customer = 'CUSTOMER',
    Supplier = 'SUPPLIER',
    Both     = 'BOTH',
  }
  ```

- [ ] Créer `src/modules/contacts/domain/contact.ts`
  ```
  id            : string
  type          : ContactType
  companyName   : string
  contactName   : string | null
  email         : string | null
  phone         : string | null
  street        : string | null
  city          : string | null
  postalCode    : string | null
  country       : string          (défaut : 'FR')
  siret         : string | null
  vatNumber     : string | null   (n° TVA intracommunautaire)
  notes         : string | null
  isActive      : boolean
  createdAt     : Date
  updatedAt     : Date
  ```

- [ ] Créer `src/modules/contacts/domain/contact-repository.port.ts`
  - `findAll(filters, pagination): Promise<{ contacts: Contact[]; total: number }>`
  - `findById(id): Promise<Contact | null>`
  - `create(data): Promise<Contact>`
  - `update(id, data): Promise<Contact>`
  - `softDelete(id): Promise<void>`
  - `hasActiveRelations(id): Promise<boolean>` (vérifie devis/commandes actifs — implémenté après module 05)

---

## 2 · Infrastructure

- [ ] Créer `TypeOrmContactEntity`
  - Table `contacts`
  - Colonne `type` : enum ContactType
  - Colonne `siret` : varchar(14), nullable
  - Colonne `vat_number` : varchar(20), nullable
  - `@DeleteDateColumn()` pour soft-delete
  - Index sur `company_name`, `email`

- [ ] Créer migration `CreateContactsTable`

- [ ] Implémenter `TypeOrmContactRepository`

- [ ] Créer `ContactMapper`
  - `toDomain(entity): Contact`
  - `toPersistence(domain): TypeOrmContactEntity`

---

## 3 · Application — Use Cases

- [ ] **`ListContactsUseCase`**
  - Filtre : `type?`, `isActive?`, `search?` (sur `companyName` / `email` / `contactName`)
  - Pagination : `page`, `limit`, `sortBy` (défaut : `companyName`), `sortOrder`
  - Retourne `{ contacts, total }`

- [ ] **`GetContactByIdUseCase`**
  - Lève `ResourceNotFoundException` si inexistant ou soft-deleted

- [ ] **`CreateContactUseCase`**
  - Validation format SIRET si fourni (14 chiffres, clé de Luhn)
  - Email normalisé (trim + lowercase) si fourni
  - Logge `contacts.created`

- [ ] **`UpdateContactUseCase`**
  - Mêmes validations que Create pour les champs modifiés
  - Logge `contacts.updated`

- [ ] **`DeleteContactUseCase`**
  - Vérifie `hasActiveRelations()` → lève `ConflictException` si devis/commandes actifs liés
  - Soft-delete
  - Logge `contacts.deleted`

---

## 4 · Présentation

### 4.1 DTOs

- [ ] `CreateContactDto`
  - `type: ContactType` (IsEnum, obligatoire)
  - `companyName: string` (MinLength 1, MaxLength 255)
  - `contactName?: string`
  - `email?: string` (IsEmail)
  - `phone?: string`
  - `street?: string`, `city?: string`, `postalCode?: string`, `country?: string` (défaut 'FR')
  - `siret?: string` (Length 14, IsNumberString)
  - `vatNumber?: string`
  - `notes?: string`

- [ ] `UpdateContactDto` — même structure, tout optionnel (PartialType)

- [ ] `ContactResponseDto`
  - Tous les champs de `Contact` (pas de données sensibles à masquer ici)

- [ ] `ContactsPageDto`
  - `data: ContactResponseDto[]`, `total`, `page`, `limit`, `totalPages`

### 4.2 Controller — `ContactsController` (`/contacts`)

- [ ] `GET /contacts` — tous les rôles authentifiés
  - Query : `type`, `isActive`, `search`, `page`, `limit`, `sortBy`, `sortOrder`
  - Retourne `ContactsPageDto`

- [ ] `GET /contacts/:id` — tous les rôles authentifiés
  - Retourne `ContactResponseDto`

- [ ] `POST /contacts` — `@Roles(Admin, Manager)`
  - Body : `CreateContactDto`
  - Retourne `ContactResponseDto` (201)

- [ ] `PATCH /contacts/:id` — `@Roles(Admin, Manager)`
  - Body : `UpdateContactDto`
  - Retourne `ContactResponseDto`

- [ ] `DELETE /contacts/:id` — `@Roles(Admin)`
  - Soft-delete (204)

---

## 5 · Règles métier

| Règle | Détail |
|-------|--------|
| SIRET | Si fourni : 14 chiffres, validation Luhn (algorithme standard FR) |
| Suppression | Bloquée si des devis ou commandes non clôturés existent pour ce contact |
| Type BOTH | Un contact BOTH peut être utilisé comme client ET comme fournisseur |
| Email | Normalisé avant stockage, non obligatoire (certains fournisseurs n'en ont pas) |

---

## 6 · Actions Audit

| Action | Déclencheur |
|--------|-------------|
| `contacts.created` | `CreateContactUseCase` |
| `contacts.updated` | `UpdateContactUseCase` |
| `contacts.deleted` | `DeleteContactUseCase` |

---

## 7 · Tests

- [ ] **Unit** : `CreateContactUseCase` — SIRET invalide → BadRequestException
- [ ] **Unit** : `DeleteContactUseCase` — contact avec devis actifs → ConflictException
- [ ] **Integration** : `TypeOrmContactRepository` — findAll avec filtre type + search
- [ ] **E2E** : `POST /contacts` → `GET /contacts/:id` → `PATCH /contacts/:id` → `DELETE /contacts/:id`
- [ ] **E2E** : `GET /contacts?type=CUSTOMER&search=dupont` — retourne résultats filtrés
