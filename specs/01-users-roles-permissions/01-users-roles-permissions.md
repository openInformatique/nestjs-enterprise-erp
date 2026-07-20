# 01 · Utilisateurs, Rôles & Permissions

> **Dépendances** : aucune (module racine, étend le module `users` existant)  
> **Modules réutilisés** : `Auth` (JWT déjà opérationnel), `Audit`

---

## Contexte

Le module `users` existe déjà avec un domaine minimal (pas de rôle). Ce module l'étend pour :
- Ajouter l'enum `UserRole` (ADMIN / MANAGER / EMPLOYEE)
- Exposer un CRUD complet d'administration des utilisateurs
- Créer le guard et le décorateur de rôles utilisés par tous les modules suivants

---

## 1 · Domaine

- [ ] Créer `src/common/enums/user-role.enum.ts`
  ```ts
  export enum UserRole {
    Admin    = 'ADMIN',
    Manager  = 'MANAGER',
    Employee = 'EMPLOYEE',
  }
  ```
- [ ] Étendre `src/modules/users/domain/user.ts` : ajouter le champ `role: UserRole`
- [ ] Mettre à jour `UserRepositoryPort` avec les méthodes :
  - `findAll(filters): Promise<{ users: User[]; total: number }>`
  - `findByEmail(email): Promise<User | null>` (déjà présent en auth, exposer ici)
  - `create(data): Promise<User>`
  - `update(id, data): Promise<User>`
  - `softDelete(id): Promise<void>`

---

## 2 · Infrastructure

- [ ] Mettre à jour `TypeOrmUserEntity` : ajouter colonne `role` (enum, default `EMPLOYEE`)
- [ ] Créer migration `AddRoleToUsers`
  - `ALTER TABLE users ADD COLUMN role user_role_enum NOT NULL DEFAULT 'EMPLOYEE'`
- [ ] Implémenter les nouvelles méthodes dans `TypeOrmUserRepository`
- [ ] Mettre à jour `UserMapper` pour inclure le champ `role`

---

## 3 · Application — Use Cases

- [ ] **`ListUsersUseCase`**
  - Filtre : `role?`, `isActive?`, `search?` (sur email / displayName)
  - Pagination : `page`, `limit`
  - Retourne `{ users, total }`

- [ ] **`CreateUserUseCase`**
  - Vérifie l'unicité de l'email (lève `ConflictException`)
  - Hash le mot de passe en Argon2id (réutiliser le service existant)
  - Rôle par défaut : `EMPLOYEE`
  - Logge `users.created` dans Audit

- [ ] **`UpdateUserUseCase`**
  - Champs modifiables : `displayName`, `isActive`
  - Logge `users.updated`

- [ ] **`ChangeUserRoleUseCase`**
  - ADMIN uniquement (vérifié au niveau du guard, mais aussi en use case)
  - Un ADMIN ne peut pas rétrograder le seul ADMIN restant
  - Logge `users.role_changed`

- [ ] **`DeactivateUserUseCase`**
  - Soft-delete (pose `deletedAt`, `isActive = false`)
  - Un utilisateur ne peut pas se supprimer lui-même
  - Logge `users.deactivated`

- [ ] **`GetUserByIdUseCase`** — déjà existant, vérifier qu'il retourne le champ `role`

---

## 4 · Présentation

### 4.1 Guard & Décorateur (utilisés dans TOUS les modules suivants)

- [ ] Créer `src/common/decorators/roles.decorator.ts`
  ```ts
  export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
  ```
- [ ] Créer `src/common/guards/roles.guard.ts`
  - Lit le rôle depuis `request.user` (nécessite d'enrichir le payload JWT avec le `role`)
  - Compare avec les rôles déclarés via `@Roles()`
  - Retourne `ForbiddenException` si insuffisant
- [ ] **Mettre à jour `TokenService`** : inclure `role` dans le payload du access token
- [ ] Enregistrer `RolesGuard` comme guard global dans `AppModule` (après `JwtAuthGuard`)

### 4.2 DTOs

- [ ] `CreateUserDto`
  - `email: string` (IsEmail)
  - `password: string` (MinLength 8, StrongPassword)
  - `displayName: string`
  - `role?: UserRole` (default EMPLOYEE)

- [ ] `UpdateUserDto`
  - `displayName?: string`
  - `isActive?: boolean`

- [ ] `ChangeRoleDto`
  - `role: UserRole` (IsEnum)

- [ ] `UserResponseDto`
  - `id`, `email`, `displayName`, `role`, `isActive`, `createdAt`, `lastLoginAt`

- [ ] `UsersPageDto`
  - `data: UserResponseDto[]`, `total`, `page`, `limit`, `totalPages`

### 4.3 Controller — `UsersController` (`/users`)

- [ ] `GET /users` — `@Roles(Admin, Manager)`
  - Query : `page`, `limit`, `role`, `isActive`, `search`
  - Retourne `UsersPageDto`

- [ ] `GET /users/me` — tous les rôles authentifiés
  - Retourne le profil de l'utilisateur courant (`UserResponseDto`)

- [ ] `PATCH /users/me` — tous les rôles authentifiés
  - Modifie `displayName` uniquement (pas le rôle, pas isActive)

- [ ] `GET /users/:id` — `@Roles(Admin, Manager)` ou soi-même
  - Retourne `UserResponseDto`

- [ ] `POST /users` — `@Roles(Admin)`
  - Body : `CreateUserDto`
  - Retourne `UserResponseDto` (201)

- [ ] `PATCH /users/:id` — `@Roles(Admin)` ou soi-même (sans `isActive`)
  - Body : `UpdateUserDto`

- [ ] `PATCH /users/:id/role` — `@Roles(Admin)`
  - Body : `ChangeRoleDto`

- [ ] `DELETE /users/:id` — `@Roles(Admin)`
  - Soft-delete (204)

---

## 5 · Règles métier

| Règle | Détail |
|-------|--------|
| Email unique | Normalisé (trim + lowercase) avant écriture |
| Mot de passe | Hash Argon2id, jamais exposé dans les réponses |
| Dernier ADMIN | Impossible de supprimer ou rétrograder le dernier ADMIN |
| Auto-suppression | Un utilisateur ne peut pas se supprimer lui-même |
| Payload JWT | Doit inclure `role` pour que le `RolesGuard` fonctionne sans BDD |

---

## 6 · Actions Audit

| Action | Déclencheur |
|--------|-------------|
| `users.created` | `CreateUserUseCase` |
| `users.updated` | `UpdateUserUseCase` |
| `users.role_changed` | `ChangeUserRoleUseCase` |
| `users.deactivated` | `DeactivateUserUseCase` |

---

## 7 · Tests

- [ ] **Unit** : `ListUsersUseCase` — filtre, pagination
- [ ] **Unit** : `CreateUserUseCase` — email déjà pris → ConflictException
- [ ] **Unit** : `ChangeUserRoleUseCase` — dernier ADMIN → exception
- [ ] **Unit** : `DeactivateUserUseCase` — auto-suppression → exception
- [ ] **Integration** : `TypeOrmUserRepository` — findAll avec filtres
- [ ] **E2E** : `POST /users` → `GET /users/:id` → `PATCH /users/:id/role` → `DELETE /users/:id`
