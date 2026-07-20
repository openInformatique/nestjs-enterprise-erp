# mini-DEV-02 · Contacts (Clients & Fournisseurs) — l'essentiel pour démarrer

> **Spec couverte** : `specs/02-contacts-clients-fournisseurs/02-contacts-clients-fournisseurs.md` (version minimale)
> **Niveau** : 🟢 fonctionnel — même logique que `mini-DEV-01` (voir `RECAP-DEV-01` pour la philosophie des 3 niveaux).
> **Prérequis** : avoir terminé `mini-DEV-01` (module 01). Ce guide réutilise `UserRole`, `@Roles()`, le `RolesGuard` global et les exceptions du socle créés là-bas.
> **Promesse** : à la fin, un CRUD complet de contacts (clients / fournisseurs / les deux), paginé, filtré, protégé par rôles, visible dans Swagger. C'est le module le plus simple de l'ERP — environ 1 h 30 à 2 h.

---

## Table des matières

- [0 · Avant de commencer](#0--avant-de-commencer)
- [B · Ce qu'on va construire](#b--ce-quon-va-construire)
- [Étape 1 — Le domaine : enum, entité `Contact`, port](#étape-1--le-domaine--enum-entité-contact-port)
- [Étape 2 — L'entité TypeORM et le mapper](#étape-2--lentité-typeorm-et-le-mapper)
- [Étape 3 — La migration (nouvelle méthode : générée)](#étape-3--la-migration-nouvelle-méthode--générée)
- [Étape 4 — Le repository TypeORM](#étape-4--le-repository-typeorm)
- [Étape 5 — Les cas d'utilisation (5 use cases)](#étape-5--les-cas-dutilisation-5-use-cases)
- [Étape 6 — Les DTOs](#étape-6--les-dtos)
- [Étape 7 — Le contrôleur](#étape-7--le-contrôleur)
- [Étape 8 — Le module + enregistrement dans AppModule](#étape-8--le-module--enregistrement-dans-appmodule)
- [Étape 9 — Vérifier que ça marche & ce qu'on verra plus tard](#étape-9--vérifier-que-ça-marche--ce-quon-verra-plus-tard)

---

## 0 · Avant de commencer

### 0.1 Prérequis

- `mini-DEV-01` terminé : l'API démarre, le login fonctionne, `admin@local.dev` est ADMIN, les routes `/users` répondent.
- Docker + la base démarrés (`npm run docker:db:up`), l'API en watch (`npm run start:dev`).

Si tu as besoin de te rafraîchir la mémoire sur le socle (architecture hexagonale, enveloppe de réponse, exceptions, pagination), relis la **section A de `mini-DEV-01`** — tout s'applique à l'identique ici, on ne le répète pas.

### 0.2 Ce qui change par rapport au module 01

Le module 01 **étendait** un module existant. Ici, on crée un module **entièrement neuf**, de zéro : c'est le patron que tu répéteras pour les modules 03 à 08. Deux nouveautés en route :

1. **La migration sera générée automatiquement** par TypeORM à partir de l'entité (au lieu d'être écrite à la main) — c'est la méthode standard pour une *nouvelle* table.
2. **Il faudra enregistrer le module dans `AppModule`** (le module 01 y était déjà).

---

## B · Ce qu'on va construire

Un contact représente un client, un fournisseur, ou **les deux** (`BOTH`) — une seule table pour les trois cas, c'est le choix de la spec (réaliste et simple).

| Méthode & route | Accès | Description |
|---|---|---|
| `GET /api/v1/contacts` | tout connecté | Liste paginée ; filtres `type`, `isActive`, `search` (nom société / e-mail / nom contact) |
| `GET /api/v1/contacts/:id` | tout connecté | Détail (404 si inconnu ou supprimé) |
| `POST /api/v1/contacts` | ADMIN, MANAGER | Créer un contact (201) |
| `PATCH /api/v1/contacts/:id` | ADMIN, MANAGER | Modifier (tous les champs optionnels) |
| `DELETE /api/v1/contacts/:id` | ADMIN | Désactiver (soft-delete, 204) |

> 👀 **Remarque** : contrairement aux utilisateurs, la **lecture** des contacts est ouverte à tous les rôles (un EMPLOYEE doit pouvoir consulter un client pour faire un devis au module 05). Seule l'**écriture** est restreinte. Tu vas voir comme c'est simple à exprimer : les routes GET n'ont juste **pas** de décorateur `@Roles`.

**Fichiers créés (14)** — tous dans `src/modules/contacts/` sauf la migration :

```
src/modules/contacts/domain/contact-type.enum.ts
src/modules/contacts/domain/contact.ts
src/modules/contacts/domain/contact-repository.port.ts
src/modules/contacts/infrastructure/entities/contact.entity.ts
src/modules/contacts/infrastructure/contact.mapper.ts
src/modules/contacts/infrastructure/typeorm-contact.repository.ts
src/modules/contacts/application/list-contacts.use-case.ts
src/modules/contacts/application/get-contact-by-id.use-case.ts
src/modules/contacts/application/create-contact.use-case.ts
src/modules/contacts/application/update-contact.use-case.ts
src/modules/contacts/application/delete-contact.use-case.ts
src/modules/contacts/presentation/dto/list-contacts-query.dto.ts
src/modules/contacts/presentation/dto/create-contact.dto.ts
src/modules/contacts/presentation/dto/update-contact.dto.ts
src/modules/contacts/presentation/dto/contact-response.dto.ts
src/modules/contacts/presentation/contacts.controller.ts
src/modules/contacts/contacts.module.ts
src/database/migrations/<timestamp>-CreateContactsTable.ts   (générée)
```

**Fichier modifié (1)** : `src/app.module.ts` (enregistrement du nouveau module).

**Différé aux niveaux supérieurs** (détail à l'étape 9) : la validation Luhn du SIRET, le blocage de suppression si devis/commandes actifs (impossible avant le module 05 de toute façon — la spec le dit elle-même), l'audit, les tests.

---

## Étape 1 — Le domaine : enum, entité `Contact`, port

On commence TOUJOURS par le domaine : les concepts métier purs, sans NestJS ni TypeORM.

### ➕ Créer `src/modules/contacts/domain/contact-type.enum.ts`

> Crée l'arborescence `src/modules/contacts/domain/`.

```typescript
/**
 * Nature d'un contact vis-à-vis de l'entreprise.
 *
 * BOTH couvre le cas réel d'un partenaire à la fois client et
 * fournisseur : il est alors utilisable dans les devis/commandes clients
 * ET dans les commandes fournisseurs (modules 05 et 06).
 */
export enum ContactType {
  Customer = 'CUSTOMER',
  Supplier = 'SUPPLIER',
  Both = 'BOTH',
}
```

### ➕ Créer `src/modules/contacts/domain/contact.ts`

```typescript
import { ContactType } from './contact-type.enum';

/**
 * Modèle de domaine du contact (client et/ou fournisseur).
 *
 * Classe pure : aucune dépendance à NestJS ou TypeORM. Seuls `type`,
 * `companyName` et `country` sont obligatoires : un fournisseur sans
 * e-mail ou un client sans SIRET sont des cas parfaitement réels.
 */
export class Contact {
  constructor(
    public readonly id: string,
    public readonly type: ContactType,
    public readonly companyName: string,
    public readonly contactName: string | null,
    public readonly email: string | null,
    public readonly phone: string | null,
    public readonly street: string | null,
    public readonly city: string | null,
    public readonly postalCode: string | null,
    /** Code pays ISO à 2 lettres ; 'FR' par défaut. */
    public readonly country: string,
    /** SIRET français (14 chiffres) si connu. */
    public readonly siret: string | null,
    /** Numéro de TVA intracommunautaire si connu. */
    public readonly vatNumber: string | null,
    public readonly notes: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  /**
   * Utilisable comme CLIENT (devis, commandes clients, factures).
   * Les modules 05, 06 et 07 s'appuieront sur cette méthode.
   */
  isCustomer(): boolean {
    return (
      this.type === ContactType.Customer || this.type === ContactType.Both
    );
  }

  /**
   * Utilisable comme FOURNISSEUR (commandes fournisseurs).
   * Le module 06 s'appuiera sur cette méthode.
   */
  isSupplier(): boolean {
    return (
      this.type === ContactType.Supplier || this.type === ContactType.Both
    );
  }
}
```

> 💡 **Pourquoi `isCustomer()` / `isSupplier()` dès maintenant ?** C'est LA valeur d'un modèle de domaine : la règle « un BOTH compte comme client ET comme fournisseur » est écrite UNE fois, ici. Quand le module 05 devra vérifier « ce contact peut-il recevoir un devis ? », il appellera `contact.isCustomer()` au lieu de dupliquer la comparaison d'enum.

### ➕ Créer `src/modules/contacts/domain/contact-repository.port.ts`

```typescript
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import { Contact } from './contact';
import { ContactType } from './contact-type.enum';

/** Critères de listing des contacts. */
export interface ListContactsQuery {
  page: number;
  limit: number;
  /** Colonne logique de tri (validée contre la liste blanche du module). */
  sortBy?: string;
  sortDirection: SortDirection;
  /** Recherche textuelle sur companyName, email et contactName. */
  search?: string;
  type?: ContactType;
  isActive?: boolean;
}

/**
 * Données de création d'un contact.
 * Les valeurs optionnelles sont déjà résolues par le use case :
 * ici, « absent » se dit `null` (et sera NULL en base).
 */
export interface CreateContactData {
  type: ContactType;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  siret: string | null;
  vatNumber: string | null;
  notes: string | null;
}

/** Champs modifiables d'un contact (tous optionnels). */
export interface UpdateContactData {
  type?: ContactType;
  companyName?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string;
  siret?: string | null;
  vatNumber?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

/**
 * Contrat de persistance des contacts.
 * Les recherches excluent les contacts supprimés logiquement.
 *
 * NOTE : la spec prévoit aussi hasActiveRelations(id) pour bloquer la
 * suppression d'un contact lié à des devis/commandes actifs. Elle sera
 * ajoutée quand ces modules existeront (à partir du module 05) — la
 * spec elle-même la décrit comme « implémentée après module 05 ».
 */
export interface ContactRepositoryPort {
  findAll(query: ListContactsQuery): Promise<PaginatedResult<Contact>>;
  findById(id: string): Promise<Contact | null>;
  create(data: CreateContactData): Promise<Contact>;
  update(id: string, data: UpdateContactData): Promise<Contact>;
  softDelete(id: string): Promise<void>;
}

/** Jeton d'injection du repository contacts. */
export const CONTACT_REPOSITORY = Symbol('CONTACT_REPOSITORY');
```

> 💡 **`null` vs `undefined`, la convention du projet** : dans `CreateContactData`, un champ absent vaut `null` (= « pas de valeur », stocké NULL en base). Dans `UpdateContactData`, `undefined` signifie « non fourni, ne pas toucher » et `null` signifie « effacer la valeur ». Cette distinction est LE piège classique des PATCH — elle est gérée proprement au niveau du repository (étape 4).

**✅ Point de contrôle** : `npm run build`

---

## Étape 2 — L'entité TypeORM et le mapper

### ➕ Créer `src/modules/contacts/infrastructure/entities/contact.entity.ts`

> Crée l'arborescence `src/modules/contacts/infrastructure/entities/`.

```typescript
import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../../../../common/entities/auditable.entity';
import { ContactType } from '../../domain/contact-type.enum';

/**
 * Entité TypeORM de la table `contacts`.
 *
 * Une seule table pour clients, fournisseurs et mixtes (colonne `type`).
 * Index sur company_name et email : ce sont les colonnes de recherche.
 * SQL Server n'a pas de type enum : `type` est un nvarchar contraint
 * par la validation applicative (DTO + enum TypeScript).
 */
@Entity({ name: 'contacts' })
export class ContactEntity extends AuditableEntity {
  @Column({ name: 'type', type: 'nvarchar', length: 10 })
  type!: ContactType;

  @Index('IX_contacts_company_name')
  @Column({ name: 'company_name', type: 'nvarchar', length: 255 })
  companyName!: string;

  @Column({ name: 'contact_name', type: 'nvarchar', length: 255, nullable: true })
  contactName!: string | null;

  @Index('IX_contacts_email')
  @Column({ name: 'email', type: 'nvarchar', length: 320, nullable: true })
  email!: string | null;

  @Column({ name: 'phone', type: 'nvarchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ name: 'street', type: 'nvarchar', length: 255, nullable: true })
  street!: string | null;

  @Column({ name: 'city', type: 'nvarchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ name: 'postal_code', type: 'nvarchar', length: 20, nullable: true })
  postalCode!: string | null;

  /** Code pays ISO 3166-1 alpha-2 (FR, BE, DE...). */
  @Column({ name: 'country', type: 'nvarchar', length: 2, default: 'FR' })
  country!: string;

  /** SIRET français : 14 chiffres (format vérifié par le DTO). */
  @Column({ name: 'siret', type: 'nvarchar', length: 14, nullable: true })
  siret!: string | null;

  @Column({ name: 'vat_number', type: 'nvarchar', length: 20, nullable: true })
  vatNumber!: string | null;

  /** nvarchar(max) : texte libre sans limite utile côté SQL. */
  @Column({ name: 'notes', type: 'nvarchar', length: 'max', nullable: true })
  notes!: string | null;

  /** Un contact inactif n'apparaît plus dans les sélections par défaut. */
  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive!: boolean;
}
```

Rappels (mêmes principes qu'au module 01) :
- `extends AuditableEntity` fournit `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (soft-delete), `createdBy`, `updatedBy` — on ne les redéclare jamais ;
- propriété camelCase ↔ colonne snake_case via `name:`.

### ➕ Créer `src/modules/contacts/infrastructure/contact.mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Contact } from '../domain/contact';
import { ContactEntity } from './entities/contact.entity';

/**
 * Conversion entité TypeORM <-> modèle de domaine.
 * Le domaine ne voit jamais l'entité TypeORM.
 */
@Injectable()
export class ContactMapper {
  toDomain(entity: ContactEntity): Contact {
    return new Contact(
      entity.id,
      entity.type,
      entity.companyName,
      entity.contactName,
      entity.email,
      entity.phone,
      entity.street,
      entity.city,
      entity.postalCode,
      entity.country,
      entity.siret,
      entity.vatNumber,
      entity.notes,
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 3 — La migration (nouvelle méthode : générée)

Au module 01, on avait **écrit** la migration à la main (`migration:create`) car il s'agissait d'un `ALTER TABLE` précis. Pour une **table entièrement nouvelle**, TypeORM sait générer la migration tout seul en comparant les entités déclarées avec le schéma réel de la base :

```bash
npm run migration:generate -- src/database/migrations/CreateContactsTable
```

Un fichier `src/database/migrations/<timestamp>-CreateContactsTable.ts` apparaît, contenant le `CREATE TABLE "contacts" (...)` complet (colonnes, défauts, index) déduit de ton entité.

**⚠️ Règle d'hygiène : toujours RELIRE une migration générée avant de l'exécuter.** Ouvre le fichier et vérifie :

- `up()` contient un `CREATE TABLE "contacts"` avec les colonnes attendues (`type`, `company_name`, `email`, `country` avec `DEFAULT 'FR'`, `is_active` avec `DEFAULT 1`, `deleted_at`…) ;
- deux `CREATE INDEX` : `IX_contacts_company_name` et `IX_contacts_email` ;
- `down()` fait l'inverse (drop des index puis de la table) ;
- **il n'y a RIEN d'autre** : si tu vois des `ALTER TABLE` sur `users` ou d'autres tables, c'est que ton entité ou ta base a dérivé — ne lance pas, demande de l'aide.

> 💡 Les noms de contraintes générés (`DF_xxxx`, `PK_xxxx`) contiennent des suffixes aléatoires : c'est normal, ne les modifie pas.

Puis applique :

```bash
npm run migration:run
npm run migration:show   # CreateContactsTable doit être cochée [X]
```

**✅ Point de contrôle** : `npm run migration:show` — et dans ton client SQL, la table `contacts` existe.

---

## Étape 4 — Le repository TypeORM

L'implémentation du port. Même patron qu'au module 01 : liste blanche de tri, recherche sécurisée, pagination du socle.

### ➕ Créer `src/modules/contacts/infrastructure/typeorm-contact.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { SortDirection } from '../../../common/pagination/sort-direction.enum';
import {
  ColumnWhitelist,
  TypeOrmFilterHelper,
} from '../../../common/pagination/typeorm-filter.helper';
import { TypeOrmPaginationHelper } from '../../../common/pagination/typeorm-pagination.helper';
import { Contact } from '../domain/contact';
import {
  ContactRepositoryPort,
  CreateContactData,
  ListContactsQuery,
  UpdateContactData,
} from '../domain/contact-repository.port';
import { ContactEntity } from './entities/contact.entity';
import { ContactMapper } from './contact.mapper';

/**
 * Liste blanche de tri : nom logique exposé par l'API -> expression
 * TypeORM. Une valeur hors liste est rejetée en 400 (anti-injection).
 */
const CONTACT_SORTABLE_COLUMNS: ColumnWhitelist = {
  companyName: 'contact.companyName',
  type: 'contact.type',
  city: 'contact.city',
  country: 'contact.country',
  isActive: 'contact.isActive',
  createdAt: 'contact.createdAt',
};

/** Colonnes parcourues par la recherche textuelle (paramètre search). */
const CONTACT_SEARCHABLE_COLUMNS = [
  'contact.companyName',
  'contact.email',
  'contact.contactName',
] as const;

/**
 * Implémentation TypeORM du repository contacts.
 * Les recherches standard excluent les lignes soft-deletées.
 */
@Injectable()
export class TypeOrmContactRepository implements ContactRepositoryPort {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly repository: Repository<ContactEntity>,
    private readonly mapper: ContactMapper,
  ) {}

  async findAll(query: ListContactsQuery): Promise<PaginatedResult<Contact>> {
    const queryBuilder = this.repository.createQueryBuilder('contact');

    if (query.type !== undefined) {
      queryBuilder.andWhere('contact.type = :type', { type: query.type });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('contact.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    TypeOrmFilterHelper.applySearch(
      queryBuilder,
      query.search,
      CONTACT_SEARCHABLE_COLUMNS,
    );

    if (query.sortBy === undefined) {
      // Tri par défaut de la spec : alphabétique sur le nom de société.
      queryBuilder.orderBy('contact.companyName', SortDirection.Asc);
    } else {
      TypeOrmFilterHelper.applySort(
        queryBuilder,
        query.sortBy,
        query.sortDirection,
        CONTACT_SORTABLE_COLUMNS,
      );
    }

    const result = await TypeOrmPaginationHelper.paginate(
      queryBuilder,
      query.page,
      query.limit,
    );

    return {
      items: result.items.map((entity) => this.mapper.toDomain(entity)),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<Contact | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async create(data: CreateContactData): Promise<Contact> {
    // Les clés de CreateContactData portent exactement les mêmes noms
    // que les propriétés de l'entité : la copie directe est sûre.
    const entity = await this.repository.save(
      this.repository.create({ ...data, isActive: true }),
    );
    return this.mapper.toDomain(entity);
  }

  async update(id: string, data: UpdateContactData): Promise<Contact> {
    // undefined = « non fourni, ne pas toucher » ; null = « effacer ».
    // On ne copie donc QUE les clés réellement fournies.
    const changes: Partial<ContactEntity> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (changes as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }

    // Relecture : renvoie l'état réel en base (updated_at recalculé).
    const entity = await this.repository.findOne({ where: { id } });
    // L'appelant (use case) a vérifié l'existence avant de modifier.
    return this.mapper.toDomain(entity as ContactEntity);
  }

  async softDelete(id: string): Promise<void> {
    // is_active = false AVANT le soft-delete : une ligne restaurée un
    // jour ne doit pas revenir active par surprise.
    await this.repository.update({ id }, { isActive: false });
    await this.repository.softDelete({ id });
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 5 — Les cas d'utilisation (5 use cases)

> Crée le dossier `src/modules/contacts/application/`.

Rappel du patron : une classe, une méthode `execute()`, les règles métier, le repository via le port. Le module contacts a peu de règles (c'est un carnet d'adresses enrichi) : les use cases sont courts — c'est NORMAL, ne cherche pas à les remplir.

### ➕ Créer `src/modules/contacts/application/list-contacts.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Contact } from '../domain/contact';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type {
  ContactRepositoryPort,
  ListContactsQuery,
} from '../domain/contact-repository.port';

/** Cas d'utilisation : lister les contacts (pagination + filtres). */
@Injectable()
export class ListContactsUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  execute(query: ListContactsQuery): Promise<PaginatedResult<Contact>> {
    return this.contactRepository.findAll(query);
  }
}
```

### ➕ Créer `src/modules/contacts/application/get-contact-by-id.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Contact } from '../domain/contact';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type { ContactRepositoryPort } from '../domain/contact-repository.port';

/**
 * Cas d'utilisation : récupérer un contact par son identifiant.
 * Lève RESOURCE_NOT_FOUND si inexistant ou supprimé logiquement.
 */
@Injectable()
export class GetContactByIdUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  async execute(contactId: string): Promise<Contact> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new ResourceNotFoundException('Le contact');
    }
    return contact;
  }
}
```

### ➕ Créer `src/modules/contacts/application/create-contact.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Contact } from '../domain/contact';
import { ContactType } from '../domain/contact-type.enum';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type { ContactRepositoryPort } from '../domain/contact-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateContactInput {
  type: ContactType;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  siret?: string;
  vatNumber?: string;
  notes?: string;
}

/**
 * Cas d'utilisation : créer un contact.
 *
 * Normalisations appliquées ici (et pas dans le DTO : le DTO valide,
 * le use case transforme) :
 *   - e-mail : trim + minuscules, comme partout dans le projet ;
 *   - pays : 'FR' par défaut, forcé en majuscules ;
 *   - « absent » devient null (convention du port).
 *
 * Le format du SIRET (14 chiffres) est garanti par le DTO ; la
 * validation de sa clé (algorithme de Luhn) arrive au niveau min-.
 */
@Injectable()
export class CreateContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  execute(input: CreateContactInput): Promise<Contact> {
    return this.contactRepository.create({
      type: input.type,
      companyName: input.companyName.trim(),
      contactName: input.contactName?.trim() ?? null,
      email: input.email ? input.email.trim().toLowerCase() : null,
      phone: input.phone ?? null,
      street: input.street ?? null,
      city: input.city ?? null,
      postalCode: input.postalCode ?? null,
      country: (input.country ?? 'FR').toUpperCase(),
      siret: input.siret ?? null,
      vatNumber: input.vatNumber ?? null,
      notes: input.notes ?? null,
    });
  }
}
```

### ➕ Créer `src/modules/contacts/application/update-contact.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Contact } from '../domain/contact';
import { ContactType } from '../domain/contact-type.enum';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type {
  ContactRepositoryPort,
  UpdateContactData,
} from '../domain/contact-repository.port';

/** Champs modifiables (tous optionnels — sémantique PATCH). */
export interface UpdateContactInput {
  type?: ContactType;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  siret?: string;
  vatNumber?: string;
  notes?: string;
  isActive?: boolean;
}

/**
 * Cas d'utilisation : modifier un contact.
 * Mêmes normalisations que la création, appliquées uniquement aux
 * champs réellement fournis.
 */
@Injectable()
export class UpdateContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  async execute(
    contactId: string,
    input: UpdateContactInput,
  ): Promise<Contact> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new ResourceNotFoundException('Le contact');
    }

    // Copie des champs fournis, puis normalisation de ceux qui en ont
    // besoin. Les champs absents (undefined) ne seront pas écrits en
    // base (filtrés par le repository).
    const changes: UpdateContactData = { ...input };
    if (input.companyName !== undefined) {
      changes.companyName = input.companyName.trim();
    }
    if (input.email !== undefined) {
      changes.email = input.email.trim().toLowerCase();
    }
    if (input.country !== undefined) {
      changes.country = input.country.toUpperCase();
    }

    return this.contactRepository.update(contactId, changes);
  }
}
```

### ➕ Créer `src/modules/contacts/application/delete-contact.use-case.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type { ContactRepositoryPort } from '../domain/contact-repository.port';

/**
 * Cas d'utilisation : supprimer (logiquement) un contact.
 *
 * Version minimale : la vérification « pas de devis/commandes actifs
 * liés » (hasActiveRelations → 409) sera branchée quand ces modules
 * existeront — la spec elle-même la décrit comme « implémentée après
 * module 05 ». La donnée n'étant jamais détruite (soft-delete), un
 * contact supprimé par erreur reste restaurable.
 */
@Injectable()
export class DeleteContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  async execute(contactId: string): Promise<void> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new ResourceNotFoundException('Le contact');
    }

    await this.contactRepository.softDelete(contactId);
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 6 — Les DTOs

> Crée le dossier `src/modules/contacts/presentation/dto/`.

Nouveauté de ce module : **`PartialType`**, un utilitaire NestJS qui fabrique automatiquement la version « tout optionnel » d'un DTO — parfait pour les PATCH, et exigé par la spec.

### ➕ Créer `src/modules/contacts/presentation/dto/list-contacts-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { ContactType } from '../../domain/contact-type.enum';

/**
 * Query string de GET /contacts.
 * Hérite des paramètres communs du socle (page, limit, sortBy,
 * sortDirection, search).
 */
export class ListContactsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtre par nature du contact.',
    enum: ContactType,
  })
  @IsOptional()
  @IsEnum(ContactType, {
    message:
      'Le paramètre "type" doit valoir CUSTOMER, SUPPLIER ou BOTH.',
  })
  type?: ContactType;

  @ApiPropertyOptional({
    description: 'Filtre par statut (true = actifs, false = désactivés).',
  })
  @IsOptional()
  // Une query string est toujours du texte : conversion manuelle
  // (NE PAS utiliser @Type(() => Boolean) : "false" deviendrait true).
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({
    message: 'Le paramètre "isActive" doit valoir true ou false.',
  })
  isActive?: boolean;
}
```

### ➕ Créer `src/modules/contacts/presentation/dto/create-contact.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContactType } from '../../domain/contact-type.enum';

/** Corps de POST /contacts (ADMIN et MANAGER). */
export class CreateContactDto {
  @ApiProperty({
    description: 'Nature du contact.',
    enum: ContactType,
    example: ContactType.Customer,
  })
  @IsEnum(ContactType, {
    message: 'Le type doit valoir CUSTOMER, SUPPLIER ou BOTH.',
  })
  type!: ContactType;

  @ApiProperty({ example: 'Dupont & Fils SARL' })
  @IsString()
  @MinLength(1, { message: 'Le nom de la société est obligatoire.' })
  @MaxLength(255, {
    message: 'Le nom de la société ne peut pas dépasser 255 caractères.',
  })
  companyName!: string;

  @ApiPropertyOptional({ example: 'Jean Dupont' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @ApiPropertyOptional({ example: 'contact@dupont-fils.fr' })
  @IsOptional()
  @IsEmail({}, { message: "L'e-mail est invalide." })
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({ example: '+33 1 23 45 67 89' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: '12 rue de la République' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @ApiPropertyOptional({ example: 'Lyon' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: '69002' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Code pays ISO à 2 lettres (FR si absent).',
    example: 'FR',
    default: 'FR',
  })
  @IsOptional()
  @Length(2, 2, {
    message: 'Le pays doit être un code ISO à 2 lettres (ex. : FR).',
  })
  country?: string;

  @ApiPropertyOptional({
    description: 'SIRET français : exactement 14 chiffres.',
    example: '73282932000074',
  })
  @IsOptional()
  @Matches(/^\d{14}$/, {
    message: 'Le SIRET doit contenir exactement 14 chiffres.',
  })
  siret?: string;

  @ApiPropertyOptional({
    description: 'Numéro de TVA intracommunautaire.',
    example: 'FR40303265045',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vatNumber?: string;

  @ApiPropertyOptional({ description: 'Notes libres internes.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'Les notes ne peuvent pas dépasser 2000 caractères.',
  })
  notes?: string;
}
```

### ➕ Créer `src/modules/contacts/presentation/dto/update-contact.dto.ts`

```typescript
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateContactDto } from './create-contact.dto';

/**
 * Corps de PATCH /contacts/:id (ADMIN et MANAGER).
 *
 * PartialType(CreateContactDto) fabrique automatiquement une copie du
 * DTO de création où TOUT est optionnel, en conservant les validateurs
 * (un email fourni doit toujours être un email valide) et la doc
 * Swagger. On n'ajoute que ce qui n'existe pas à la création : isActive.
 *
 * ⚠️ Importer PartialType depuis '@nestjs/swagger' (et non
 * '@nestjs/mapped-types') : c'est la variante qui préserve la
 * documentation OpenAPI.
 */
export class UpdateContactDto extends PartialType(CreateContactDto) {
  @ApiPropertyOptional({
    description: 'Réactive (true) ou désactive (false) le contact.',
  })
  @IsOptional()
  @IsBoolean({ message: 'Le champ "isActive" doit valoir true ou false.' })
  isActive?: boolean;
}
```

### ➕ Créer `src/modules/contacts/presentation/dto/contact-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Contact } from '../../domain/contact';
import { ContactType } from '../../domain/contact-type.enum';

/**
 * Représentation publique d'un contact.
 * Aucun champ sensible ici : tout le contact est exposable (spec §4.1).
 */
export class ContactResponseDto {
  @ApiProperty({ description: 'Identifiant du contact (UUID).' })
  id!: string;

  @ApiProperty({ enum: ContactType })
  type!: ContactType;

  @ApiProperty({ example: 'Dupont & Fils SARL' })
  companyName!: string;

  @ApiProperty({ nullable: true, example: 'Jean Dupont' })
  contactName!: string | null;

  @ApiProperty({ nullable: true, example: 'contact@dupont-fils.fr' })
  email!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ nullable: true })
  street!: string | null;

  @ApiProperty({ nullable: true })
  city!: string | null;

  @ApiProperty({ nullable: true })
  postalCode!: string | null;

  @ApiProperty({ example: 'FR' })
  country!: string;

  @ApiProperty({ nullable: true, example: '73282932000074' })
  siret!: string | null;

  @ApiProperty({ nullable: true, example: 'FR40303265045' })
  vatNumber!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'False pour un contact désactivé.' })
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  /** Conversion domaine -> DTO. */
  static fromDomain(contact: Contact): ContactResponseDto {
    const dto = new ContactResponseDto();
    dto.id = contact.id;
    dto.type = contact.type;
    dto.companyName = contact.companyName;
    dto.contactName = contact.contactName;
    dto.email = contact.email;
    dto.phone = contact.phone;
    dto.street = contact.street;
    dto.city = contact.city;
    dto.postalCode = contact.postalCode;
    dto.country = contact.country;
    dto.siret = contact.siret;
    dto.vatNumber = contact.vatNumber;
    dto.notes = contact.notes;
    dto.isActive = contact.isActive;
    dto.createdAt = contact.createdAt;
    dto.updatedAt = contact.updatedAt;
    return dto;
  }
}
```

**✅ Point de contrôle** : `npm run build`

---

## Étape 7 — Le contrôleur

### ➕ Créer `src/modules/contacts/presentation/contacts.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { CreateContactUseCase } from '../application/create-contact.use-case';
import { DeleteContactUseCase } from '../application/delete-contact.use-case';
import { GetContactByIdUseCase } from '../application/get-contact-by-id.use-case';
import { ListContactsUseCase } from '../application/list-contacts.use-case';
import { UpdateContactUseCase } from '../application/update-contact.use-case';
import { ContactResponseDto } from './dto/contact-response.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

/**
 * Contrôleur des contacts (clients & fournisseurs).
 *
 * Lecture ouverte à tout utilisateur authentifié (un EMPLOYEE consulte
 * les clients pour préparer devis et commandes) ; écriture réservée à
 * ADMIN/MANAGER ; suppression à ADMIN seul.
 */
@ApiTags('Contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly listContactsUseCase: ListContactsUseCase,
    private readonly getContactByIdUseCase: GetContactByIdUseCase,
    private readonly createContactUseCase: CreateContactUseCase,
    private readonly updateContactUseCase: UpdateContactUseCase,
    private readonly deleteContactUseCase: DeleteContactUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liste paginée des contacts',
    description:
      'Accessible à tous les rôles. Filtres : type, isActive, search ' +
      '(nom société / e-mail / nom du contact). Tri par défaut : nom de ' +
      'société. La pagination est renvoyée dans meta.pagination.',
  })
  @ApiOkResponse({ type: [ContactResponseDto] })
  async list(
    @Query() query: ListContactsQueryDto,
  ): Promise<PaginatedResult<ContactResponseDto>> {
    const result = await this.listContactsUseCase.execute({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      type: query.type,
      isActive: query.isActive,
    });

    return {
      items: result.items.map(ContactResponseDto.fromDomain),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un contact (tous les rôles)" })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiNotFoundResponse({ description: 'Contact inconnu ou supprimé.' })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ContactResponseDto> {
    const contact = await this.getContactByIdUseCase.execute(id);
    return ContactResponseDto.fromDomain(contact);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Créer un contact' })
  @ApiCreatedResponse({ type: ContactResponseDto })
  @ApiForbiddenResponse({ description: 'Rôle insuffisant (ACCESS_DENIED).' })
  async create(@Body() body: CreateContactDto): Promise<ContactResponseDto> {
    const contact = await this.createContactUseCase.execute(body);
    return ContactResponseDto.fromDomain(contact);
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({ summary: 'Modifier un contact' })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiNotFoundResponse({ description: 'Contact inconnu ou supprimé.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    const contact = await this.updateContactUseCase.execute(id, body);
    return ContactResponseDto.fromDomain(contact);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un contact (suppression logique)',
    description:
      'Pose deleted_at et is_active = false ; la donnée reste en base. ' +
      'Le blocage « contact lié à des devis/commandes actifs » arrivera ' +
      'avec le module 05.',
  })
  @ApiNoContentResponse({ description: 'Contact supprimé.' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.deleteContactUseCase.execute(id);
  }
}
```

**À noter** :
- Pas de route `me` ici → **pas de piège d'ordre des routes** : `:id` peut venir juste après la liste.
- `create(body)` et `update(id, body)` passent le DTO directement au use case : les formes de `CreateContactDto` et `CreateContactInput` coïncident (mêmes noms, mêmes optionnels), pas besoin de recopie champ à champ comme au module 01.

**✅ Point de contrôle** : `npm run build`

---

## Étape 8 — Le module + enregistrement dans AppModule

### ➕ Créer `src/modules/contacts/contacts.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateContactUseCase } from './application/create-contact.use-case';
import { DeleteContactUseCase } from './application/delete-contact.use-case';
import { GetContactByIdUseCase } from './application/get-contact-by-id.use-case';
import { ListContactsUseCase } from './application/list-contacts.use-case';
import { UpdateContactUseCase } from './application/update-contact.use-case';
import { CONTACT_REPOSITORY } from './domain/contact-repository.port';
import { ContactMapper } from './infrastructure/contact.mapper';
import { ContactEntity } from './infrastructure/entities/contact.entity';
import { TypeOrmContactRepository } from './infrastructure/typeorm-contact.repository';
import { ContactsController } from './presentation/contacts.controller';

/**
 * Module des contacts (clients & fournisseurs).
 *
 * Le port CONTACT_REPOSITORY et GetContactByIdUseCase sont exportés :
 * les modules devis (05), commandes (06) et factures (07) en auront
 * besoin pour vérifier leurs contacts.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ContactEntity])],
  controllers: [ContactsController],
  providers: [
    ContactMapper,
    ListContactsUseCase,
    GetContactByIdUseCase,
    CreateContactUseCase,
    UpdateContactUseCase,
    DeleteContactUseCase,
    {
      provide: CONTACT_REPOSITORY,
      useClass: TypeOrmContactRepository,
    },
  ],
  exports: [CONTACT_REPOSITORY, GetContactByIdUseCase],
})
export class ContactsModule {}
```

### ✏️ Modifier `src/app.module.ts`

Contrairement au module 01 (déjà branché), un module neuf doit être déclaré dans le module racine.

**1)** Ajoute l'import (avec les autres imports de modules, ordre alphabétique) :

```typescript
import { ContactsModule } from './modules/contacts/contacts.module';
```

**2)** Dans le tableau `imports`, ajoute `ContactsModule` après `UsersModule` :

**AVANT** :

```typescript
    UsersModule,
    AuthenticationModule,
```

**APRÈS** :

```typescript
    UsersModule,
    ContactsModule,
    AuthenticationModule,
```

**✅ Point de contrôle** :

```bash
npm run build
npm run start:dev
```

Les logs de démarrage listent les 5 routes `/api/v1/contacts*`, et Swagger affiche la section « Contacts ».

---

## Étape 9 — Vérifier que ça marche & ce qu'on verra plus tard

### 9.1 Parcours manuel (PowerShell)

```powershell
$base = "http://localhost:3000/api/v1"

# 1. Connexion en ADMIN
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"admin@local.dev","password":"MOT_DE_PASSE_ADMIN"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }

# 2. Créer un client (avec SIRET et e-mail volontairement "sales" :
#    regarde la normalisation dans la réponse)
$client = Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
  -ContentType 'application/json' -Body '{
    "type": "CUSTOMER",
    "companyName": "Dupont & Fils SARL",
    "contactName": "Jean Dupont",
    "email": "  Contact@Dupont-Fils.FR ",
    "city": "Lyon",
    "siret": "73282932000074"
  }'
$client.data          # email en minuscules, country = "FR" automatique

# 3. Créer un fournisseur SANS e-mail (cas réel autorisé par la spec)
Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
  -ContentType 'application/json' -Body '{
    "type": "SUPPLIER",
    "companyName": "Aciers de l Est",
    "city": "Metz"
  }' | Out-Null

# 4. La validation en action : SIRET à 13 chiffres → 400 VALIDATION_ERROR
try {
  Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headers `
    -ContentType 'application/json' `
    -Body '{"type":"CUSTOMER","companyName":"Test","siret":"1234567890123"}'
} catch {
  $_.Exception.Response.StatusCode   # attendu : BadRequest (400)
}

# 5. Lister : filtre par type + recherche (regarde meta.pagination)
Invoke-RestMethod -Uri "$base/contacts?type=CUSTOMER&search=dupont" -Headers $headers |
  ConvertTo-Json -Depth 5

# 6. Modifier (PATCH partiel : SEUL le téléphone change)
Invoke-RestMethod -Method Patch -Uri "$base/contacts/$($client.data.id)" `
  -Headers $headers -ContentType 'application/json' `
  -Body '{"phone":"+33 4 78 00 00 00"}'

# 7. La lecture est ouverte à tous : le compte EMPLOYEE liste sans problème...
$loginEmp = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"user@local.dev","password":"MOT_DE_PASSE_USER"}'
$headersEmp = @{ Authorization = "Bearer $($loginEmp.data.accessToken)" }
Invoke-RestMethod -Uri "$base/contacts" -Headers $headersEmp | Out-Null
"EMPLOYEE peut lire ✔"

# 8. ... mais pas écrire : 403 ACCESS_DENIED
try {
  Invoke-RestMethod -Method Post -Uri "$base/contacts" -Headers $headersEmp `
    -ContentType 'application/json' `
    -Body '{"type":"CUSTOMER","companyName":"Intrus"}'
} catch {
  $_.Exception.Response.StatusCode   # attendu : Forbidden (403)
}

# 9. Supprimer (204), puis vérifier le 404
Invoke-WebRequest -Method Delete -Uri "$base/contacts/$($client.data.id)" `
  -Headers $headers | Select-Object StatusCode
try {
  Invoke-RestMethod -Uri "$base/contacts/$($client.data.id)" -Headers $headers
} catch {
  $_.Exception.Response.StatusCode   # attendu : NotFound (404)
}
```

Même parcours possible à la souris dans **Swagger** (section « Contacts »).

### 9.2 Ce qu'on verra plus tard (rien n'est perdu)

| Différé | Pourquoi ce n'est pas bloquant | Niveau |
|---|---|---|
| **Validation Luhn du SIRET** (clé de contrôle, pas juste 14 chiffres) | Le format est déjà vérifié par le DTO ; la clé attrape les fautes de frappe, pas plus | 🟡 min- |
| **`hasActiveRelations`** (blocage de suppression si devis/commandes actifs) | Impossible à implémenter avant le module 05 — la spec le dit elle-même. Le soft-delete rend l'erreur réversible en attendant | 🟡 min- (après module 05) |
| **Audit** (`contacts.created/updated/deleted`) | Traçabilité, pas fonctionnel | 🟡 min- |
| **Tests** (unit : SIRET invalide, suppression bloquée ; intégration : findAll ; e2e : cycle complet) | L'application fonctionne ; les tests sont la garantie long terme | 🔴 complet |
| **Export CSV/XLSX + `GET /contacts/:id/history`** | Ce n'est pas le module 02 : c'est la spec 10, prévue « après module 08 » | module 10 |

### 9.3 Ce que ce module t'a appris de nouveau

1. **Créer un module de zéro** (le 01 étendait de l'existant) : c'est exactement ce patron que tu répéteras pour les modules 03 à 08.
2. **`migration:generate`** : TypeORM écrit le `CREATE TABLE` à ta place à partir de l'entité — mais on RELIT toujours avant d'exécuter.
3. **`PartialType`** : un DTO de PATCH gratuit, validations et Swagger inclus.
4. **`null` vs `undefined` dans un PATCH** : « effacer la valeur » ≠ « ne pas toucher » — géré une fois pour toutes dans le repository.
5. **La granularité des rôles par méthode HTTP** : lecture libre, écriture ADMIN/MANAGER, suppression ADMIN — juste en posant (ou pas) `@Roles` sur chaque route.
6. **Le domaine qui anticipe** : `isCustomer()` / `isSupplier()` attendent déjà les modules 05-07.

---

*Fin du guide mini-DEV-02. Prochain module : le catalogue (03) — même patron, avec en plus une deuxième entité (les catégories) et une relation entre les deux.*

