# RECAP-DEV-01 · Les 3 versions du module Utilisateurs, Rôles & Permissions

> **Spec d'origine** : `specs/01-users-roles-permissions.md`
> Ce document compare en détail les trois guides d'implémentation du module 01. Il sert de référence pour choisir par où commencer, savoir exactement ce que chaque version livre, et comprendre le chemin de montée en gamme de l'une à l'autre.
>
> La même logique à 3 niveaux sera appliquée à chacun des 10 modules de l'ERP :
>
> | Niveau | Philosophie | Question à laquelle il répond |
> |---|---|---|
> | 🟢 **mini-** | Fonctionnel | « Est-ce que ça marche ? » |
> | 🟡 **min-** | Complet | « Est-ce que ça couvre toute la spec métier ? » |
> | 🔴 **DEV-** (complet) | Industrialisé | « Est-ce que c'est prêt pour la vraie vie (équipe, prod, long terme) ? » |

---

## 1 · Vue d'ensemble en une page

| | 🟢 `mini-DEV-01` | 🟡 `min-DEV-01` | 🔴 `DEV-01` |
|---|---|---|---|
| **Objectif** | Démo fonctionnelle, apprentissage sans peur | Spec métier couverte à 100 % | Spec + qualité production |
| **Public** | Débutant complet | Dev junior à l'aise avec le mini | Équipe qui maintient le projet |
| **Taille du guide** | ~1 300 lignes, 11 étapes | ~2 400 lignes, 12 étapes | ~3 900 lignes, 15 étapes |
| **Temps estimé** | 2–3 h | 4–6 h | 7–10 h |
| **Endpoints livrés** | 6 | 8 | 8 |
| **Fichiers créés** | 11 | 16 | 21 |
| **Fichiers modifiés** | 6 | 16 | ~25 |
| **Module authentification touché ?** | 3 lignes (enregistrement du guard) | Oui — 6 fichiers (rôle dans le JWT) | Oui — 6 fichiers + leurs tests |
| **Rôle vérifié via** | Requête SQL en base (à chaque appel protégé) | Claim `role` du JWT (zéro SQL) | Claim `role` du JWT (zéro SQL) |
| **Règles métier** | Auto-désactivation interdite | Toutes (+ dernier ADMIN) | Toutes |
| **Audit** | ❌ | ✅ | ✅ |
| **Seeder mis à jour** | ❌ (requête SQL manuelle) | ❌ (requête SQL manuelle) | ✅ |
| **Tests automatisés** | ❌ | ❌ | ✅ (unit + intégration + e2e) |
| **`npm run build`** | ✅ vert | ✅ vert | ✅ vert |
| **`npm run test:*`** | ❌ anciens tests cassés (assumé) | ❌ anciens tests cassés (assumé) | ✅ tout vert |
| **Suffisant pour…** | démo interne, formation | pilote / pré-prod | production |

**Point commun essentiel** : les trois versions partagent les mêmes noms de fichiers, la même architecture (domaine → port → infrastructure → use cases → DTOs → contrôleur → module) et le même code pour ce qui est commun. Passer d'une version à la suivante = **ajouter**, jamais refaire.

---

## 2 · 🟢 `mini-DEV-01` — la version fonctionnelle

### 2.1 Philosophie

Le trajet complet d'une fonctionnalité backend, sans aucune couche « d'assurance ». Tout ce qui est présent est **correct et définitif** (rien à jeter en montant de version) ; tout ce qui manque est du confort, de la traçabilité ou de la garantie — pas du fonctionnel.

### 2.2 Ce qu'elle couvre

**Endpoints (6)** :

| Route | Accès | Comportement |
|---|---|---|
| `GET /api/v1/users` | ADMIN, MANAGER | Liste paginée ; filtres `role`, `isActive`, `search` ; tri par liste blanche |
| `GET /api/v1/users/me` | tout connecté | Profil de l'utilisateur courant (avec son rôle) |
| `GET /api/v1/users/:id` | ADMIN, MANAGER | Détail (404 si inconnu ou soft-deleted) |
| `POST /api/v1/users` | ADMIN | Création : e-mail normalisé + unicité (409), mot de passe Argon2id, rôle défaut EMPLOYEE, validation forte du mot de passe |
| `PATCH /api/v1/users/:id/role` | ADMIN | Changement de rôle (sans la protection « dernier ADMIN ») |
| `DELETE /api/v1/users/:id` | ADMIN | Désactivation : soft-delete + `is_active = false` (204) ; auto-désactivation interdite (409) |

**Briques construites** :

- Enum `UserRole` (ADMIN / MANAGER / EMPLOYEE) dans `src/common/enums/` — réutilisé par les 9 modules suivants.
- 2 exceptions du socle : `AccessDeniedException` (403, code `ACCESS_DENIED`) et `BusinessRuleViolationException` (409, code `BUSINESS_RULE_VIOLATION`).
- Champ `role` sur le domaine `User`, l'entité TypeORM et le mapper.
- Migration SQL Server `AddRoleToUsers` (colonne `nvarchar(20)` + `DEFAULT 'EMPLOYEE'`, avec son `down()`).
- Port `UserRepositoryPort` étendu : `findAll` (paginé/filtré), `create`, `update`, `softDelete` + implémentation TypeORM complète (liste blanche de tri, recherche LIKE échappée, paramètres nommés anti-injection).
- Décorateur `@Roles(...)` + `RolesGuard` **global** (enregistré après le guard JWT).
- 4 use cases : `ListUsers`, `CreateUser`, `ChangeUserRole`, `DeactivateUser` (+ `GetUserById` existant qui renvoie le rôle automatiquement).
- 4 DTOs validés/documentés Swagger : `ListUsersQueryDto` (hérite de la pagination du socle), `CreateUserDto`, `ChangeRoleDto`, `UserResponseDto` (sans `passwordHash` — anti-fuite).
- Contrôleur mince + câblage `UsersModule` (binding local `PASSWORD_HASHER` pour éviter la dépendance circulaire avec l'authentification).
- Vérification manuelle guidée (PowerShell + Swagger).

**Choix technique distinctif** : le `RolesGuard` **lit le rôle en base de données** (`findById`) à chaque appel d'une route décorée `@Roles`. Conséquences :
- ✅ aucun fichier du module d'authentification à modifier (le JWT reste `{ sub, sid, jti }`) ;
- ✅ un changement de rôle prend effet **immédiatement** ;
- ⚠️ une requête SQL par appel protégé (négligeable en démo, optimisé dans min-/complet).

### 2.3 Ce qu'elle NE couvre PAS (différé volontairement)

| Absent | Impact concret | Rattrapé où |
|---|---|---|
| `PATCH /users/:id` (modifier displayName/isActive) | Impossible de renommer/suspendre sans supprimer | min-, étapes 8–10 |
| `PATCH /users/me` (self-service) | L'utilisateur ne modifie pas son nom affiché | min-, étapes 8–10 |
| Règle « dernier ADMIN » | Un admin peut rétrograder/désactiver le dernier ADMIN → rattrapage par SQL | min-, étape 8 |
| Rôle dans le JWT | Une requête SQL par appel protégé | min-, étape 6 |
| Audit (`users.*`) | Aucune trace « qui a fait quoi » en base | min-, étape 8 |
| Seeder à jour | Promotion de l'admin par requête SQL manuelle | complet, étape 4.3 |
| Tests + correctifs des anciens tests | `npm run test:unit` échoue sur les specs existantes | complet, étapes 3, 5, 6.7, 12–14 |

---

## 3 · 🟡 `min-DEV-01` — la version complète (spec couverte)

### 3.1 Philosophie

**Tout ce que la spec `01-users-roles-permissions.md` exige fonctionnellement**, sans l'appareillage de tests. C'est la version « le module est fini » du point de vue métier et sécurité — il ne lui manque que les garanties long terme.

### 3.2 Ce qu'elle ajoute par rapport au 🟢 mini

**+2 endpoints (total 8)** :

| Route | Accès | Comportement |
|---|---|---|
| `PATCH /api/v1/users/me` | tout connecté | Modifie **uniquement** `displayName` (DTO dédié `UpdateMyProfileDto` : impossible de s'auto-réactiver, même en trichant sur le body) |
| `PATCH /api/v1/users/:id` | ADMIN | Modifie `displayName` et/ou `isActive` (le rôle reste exclusif à `/role`) |

**Le rôle embarqué dans le JWT** (le gros morceau — 6 fichiers d'authentification) :

- `TokenService` : claim `role` obligatoire sur les access tokens (signature `generateAccessToken(userId, sessionId, role)`), absent des refresh tokens.
- `AuthenticatedIdentity` + `LocalIdentityProvider` : le login remonte le rôle depuis la base.
- `LoginUseCase` : transmet le rôle au token.
- `RefreshTokensUseCase` : **relit l'utilisateur en base à chaque rotation (~15 min)** → le rôle se rafraîchit tout seul, et un compte désactivé/supprimé se voit refuser le refresh (déconnexion de fait). Bonus sécurité qui n'existe dans aucune autre version.
- `JwtAuthGuard` : pose `request.user = { userId, sessionId, role }` ; rejette les anciens tokens sans claim `role` (401 → le client se re-loggue).
- `AuthenticatedUser` (interface commune) : gagne `role`.
- Le `RolesGuard` devient **synchrone et sans SQL** : il compare le claim du JWT à la liste `@Roles`.

**+1 use case : `UpdateUserUseCase`** (sert les deux routes PATCH ; ne touche jamais au rôle).

**Les règles métier complètes** :

| Règle | Implémentation |
|---|---|
| Dernier ADMIN actif intouchable | `countActiveAdmins()` ajouté au port/repository ; vérifié dans `ChangeUserRole` (rétrogradation) ET `DeactivateUser` |
| Auto-désactivation interdite | (déjà dans mini) |
| Défense en profondeur | Les règles sont re-vérifiées dans les use cases même si le guard filtre déjà |

**L'audit complet** (`AuditService` injecté dans les use cases, `AuditModule` importé) :

| Action | Catégorie | Déclencheur |
|---|---|---|
| `users.created` | Business | `CreateUserUseCase` (métadonnées : email, rôle — jamais le mot de passe) |
| `users.updated` | Business | `UpdateUserUseCase` (métadonnées : champs modifiés) |
| `users.role_changed` | **Security** | `ChangeUserRoleUseCase` (métadonnées : from/to) |
| `users.deactivated` | **Security** | `DeactivateUserUseCase` |

**+2 DTOs** : `UpdateUserDto`, `UpdateMyProfileDto`.

### 3.3 Ce qu'elle NE couvre toujours PAS

- Le seeder (`run-seed.ts`) n'attribue pas les rôles → toujours la requête SQL manuelle pour promouvoir l'admin.
- Les fichiers de tests existants cassés par les nouveaux contrats ne sont pas corrigés → `npm run test:unit` échoue.
- Aucun test n'est écrit pour le nouveau code.
- La base de test n'est pas migrée (`migration:run:test` non nécessaire sans tests).

### 3.4 Compromis introduit (à connaître)

Avec le rôle dans le JWT, un changement de rôle/désactivation ne prend effet qu'à la **prochaine rotation du token (≤ ~15 min)** — contre « immédiat » dans le mini. C'est le prix de l'économie d'une requête SQL par appel ; le guide explique ce compromis en détail (§A.7).

---

## 4 · 🔴 `DEV-01` (complet) — la version industrialisée

### 4.1 Philosophie

Le min- + tout ce qui rend le module **maintenable par une équipe dans la durée** : les tests qui empêchent les régressions pendant le développement des modules 02 à 10, l'outillage (seed), et la remise au vert de TOUTE la suite de tests du projet.

### 4.2 Ce qu'elle ajoute par rapport au 🟡 min

**Le seeder mis à jour** (`src/database/seeds/run-seed.ts`) :
- `admin@local.dev` → rôle ADMIN, `user@local.dev` → EMPLOYEE, automatiquement à chaque `npm run seed` ;
- plus la requête SQL de rattrapage documentée pour les bases déjà seedées (le seed est idempotent : il ne modifie pas les comptes existants).

**Le helper e2e mis à jour** (`test/helpers/e2e-app.ts`) : `createE2eTestUser(app, role)` pour fabriquer des utilisateurs de test avec n'importe quel rôle.

**Les correctifs des 7 fichiers de tests existants** cassés par les nouveaux contrats (avec explications ligne à ligne) :

| Fichier | Cause de la casse |
|---|---|
| `user.spec.ts` | Constructeur de `User` (+ paramètre `role`) |
| `get-user-by-id.use-case.spec.ts` | Constructeur + port du repository (5 nouvelles méthodes à mocker) |
| `local-identity.provider.spec.ts` | Constructeur + port + l'identité renvoie le rôle |
| `login.use-case.spec.ts` | Identité avec rôle + stub complet du port |
| `refresh-tokens.use-case.spec.ts` | Nouveau paramètre de constructeur (user repository) |
| `token.service.spec.ts` | Signature de `generateAccessToken` (+ assertion sur le claim) |
| *(+ test bonus)* | « refuse la rotation d'un utilisateur désactivé » |

**Les tests du nouveau code** :

- **Unitaires (4 fichiers, ~15 cas)** — doubles écrits à la main (pattern du projet, pas de `jest.mock`) :
  - `CreateUserUseCase` : normalisation e-mail, hash, rôle par défaut, rôle explicite, e-mail déjà pris → 409 ;
  - `ChangeUserRoleUseCase` : rétrogradation OK à 2 admins, **refus du dernier ADMIN**, promotion sans compteur, no-op si rôle identique, 404 ;
  - `DeactivateUserUseCase` : désactivation + audit, auto-désactivation refusée (**y compris avec casse d'UUID différente**), dernier ADMIN refusé, 404 ;
  - `ListUsersUseCase` : délégation fidèle de la requête.
- **Intégration (1 fichier, 10 cas)** — vrai `TypeOrmUserRepository` contre la vraie base SQL Server de test : unicité e-mail, soft-delete (invisible + `is_active=false` + ligne conservée), `findAll` (filtre rôle + recherche + pagination avec marqueurs uniques anti-collision), `create`, `update` partiel, `countActiveAdmins` en delta.
- **End-to-end (1 fichier, ~13 cas)** — application complète via supertest : 401 sans token, **403 ACCESS_DENIED** pour un EMPLOYEE, liste paginée avec `meta.pagination`, self-service `/me` (rôle présent, hash absent), whitelist stricte (400 si propriété interdite), cycle de vie complet (création 201 → doublon 409 → mot de passe faible 400 → promotion → désactivation 204 → 404 → **login refusé après désactivation**), auto-désactivation 409, nettoyage physique des données de test.

**La base de test migrée** (`npm run migration:run:test`) et la checklist finale complète : `build` + `lint` + `test:unit` + `test:integration` + `test:e2e` tous verts.

### 4.3 Ce qu'elle laisse (hors périmètre du module 01)

- Révocation **immédiate** des sessions à la désactivation (aujourd'hui : effective au prochain refresh, ≤ 15 min) — mentionné comme amélioration possible.
- Permissions fines par ressource (le socle a un `AuthorizationPort` prévu pour ça, non utilisé) — hors spec.
- Les endpoints transverses (`/users/:id/history`, exports) — spec 10, plus tard.

---

## 5 · Matrice de couverture de la spec 01

| Exigence de la spec `01-users-roles-permissions.md` | 🟢 mini | 🟡 min | 🔴 complet |
|---|---|---|---|
| §1 Enum `UserRole` | ✅ | ✅ | ✅ |
| §1 Champ `role` sur le domaine | ✅ | ✅ | ✅ |
| §1 Port : `findAll`, `findByEmail`, `create`, `update`, `softDelete` | ✅ | ✅ (+`countActiveAdmins`) | ✅ |
| §2 Colonne + migration `AddRoleToUsers` | ✅ (adapté SQL Server) | ✅ | ✅ |
| §2 Mapper à jour | ✅ | ✅ | ✅ |
| §3 `ListUsersUseCase` (filtres, pagination) | ✅ | ✅ | ✅ |
| §3 `CreateUserUseCase` (unicité, Argon2id, défaut EMPLOYEE) | ✅ | ✅ | ✅ |
| §3 `UpdateUserUseCase` | ❌ | ✅ | ✅ |
| §3 `ChangeUserRoleUseCase` — dernier ADMIN protégé | ⚠️ sans la règle | ✅ | ✅ |
| §3 `DeactivateUserUseCase` — soft-delete, pas d'auto-suppression | ✅ | ✅ | ✅ |
| §3 `GetUserByIdUseCase` renvoie le rôle | ✅ | ✅ | ✅ |
| §4.1 Décorateur `@Roles` + guard global | ✅ (guard via BDD) | ✅ (guard via JWT) | ✅ |
| §4.1 `role` dans le payload JWT | ❌ (remplacé par lecture BDD) | ✅ | ✅ |
| §4.2 DTOs | 4/6 | 6/6 | 6/6 |
| §4.3 Les 8 endpoints | 6/8 | 8/8 | 8/8 |
| §5 Règles métier (tableau complet) | 4/5 | 5/5 | 5/5 |
| §6 Actions d'audit `users.*` | ❌ | ✅ | ✅ |
| §7 Tests unit / integration / e2e | ❌ | ❌ | ✅ |
| *(hors spec)* Refresh refusé si compte désactivé | ❌ | ✅ | ✅ + testé |
| *(hors spec)* Seeder avec rôles | ❌ | ❌ | ✅ |

---

## 6 · Le chemin de montée en gamme (sans rien refaire)

Les trois guides sont **emboîtés** : mêmes fichiers, mêmes conventions. Monter de version = suivre les étapes manquantes du guide supérieur.

### 🟢 mini → 🟡 min

1. Ajouter `UpdateUserUseCase` + les 2 DTOs + les 2 routes PATCH (min-, étapes 8–10).
2. Ajouter `countActiveAdmins` au port/repository et la règle « dernier ADMIN » dans 2 use cases (min-, étapes 5 et 8).
3. Injecter `AuditService` dans les 4 use cases d'écriture + importer `AuditModule` (min-, étapes 8 et 11).
4. Basculer le rôle dans le JWT : les 6 fichiers d'authentification (min-, étape 6), puis **simplifier** le `RolesGuard` (supprimer l'injection du repository, lire `user.role`) — seule vraie « modification » de code existant du parcours.

### 🟡 min → 🔴 complet

1. Mettre à jour le seeder + le helper e2e (complet, étapes 4.3–4.4).
2. Migrer la base de test : `npm run migration:run:test` (complet, étape 4).
3. Corriger les 7 fichiers de tests existants (complet, étapes 3, 5 et 6.7).
4. Écrire les tests du module : 4 specs unitaires, 1 intégration, 1 e2e (complet, étapes 12–14).
5. Checklist finale : tout vert (complet, étape 15).

---

## 7 · Quelle version pour quel usage ?

| Situation | Version conseillée |
|---|---|
| Former des collègues qui n'ont jamais développé | 🟢 mini, en atelier guidé |
| Démo interne de l'ERP à des décideurs | 🟢 mini suffit largement |
| Base de travail pour enchaîner les modules 02–10 rapidement | 🟢 mini partout, montée en gamme plus tard |
| Pilote utilisé par de vrais utilisateurs (même peu) | 🟡 min minimum (audit + règles complètes) |
| Projet qui va vivre, plusieurs devs, mises en production | 🔴 complet — les tests ne sont pas une option quand on développe à plusieurs sur 10 modules |

**Règle d'or pour les 10 dossiers à venir** : le niveau 🟢 doit toujours produire du code *définitif* (jamais du jetable), le niveau 🟡 doit couvrir *toute la spec métier*, le niveau 🔴 doit laisser *toute la suite de tests verte*. Si un élément différé obligerait à réécrire du code du niveau inférieur, c'est qu'il est au mauvais niveau.

---

*Fichiers concernés : `mini-DEV-01-users-roles-permissions.md` · `min-DEV-01-users-roles-permissions.md` · `DEV-01-users-roles-permissions.md` — tous dans `specs/`.*
