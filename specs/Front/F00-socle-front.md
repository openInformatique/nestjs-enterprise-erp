# F00 · Socle front — Projet, NobleUI, HTTP & Authentification

> **Dépendances** : back démarré (`http://localhost:3000/api/v1`), template NobleUI Angular (ThemeForest)
> **Endpoints back consommés** : `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`

---

## Contexte

Tout ce que les specs F01 à F06 tiennent pour acquis : le projet Angular scaffolé depuis NobleUI, la couche HTTP qui parle l'enveloppe `{ success, data, meta }` du back, l'authentification JWT complète (login, Bearer, refresh silencieux via cookie HttpOnly, déconnexion), les guards, le layout (sidebar par rôle) et les modèles/composants partagés. **Aucune page métier ici** — uniquement les fondations.

---

## 1 · Projet & intégration NobleUI

- [ ] Créer le projet à partir du **template NobleUI Angular** (dossier frère du back, ex. `erp-front/`) ; mettre à jour Angular CLI/core vers la dernière version si le template est en retard.
- [ ] Migrer/valider le mode **standalone** : `bootstrapApplication(AppComponent, appConfig)`, pas de `NgModule` applicatif ; les composants NobleUI conservés sont importés à la carte.
- [ ] Conserver du template : layout (sidebar, navbar, footer), styles SCSS NobleUI/Bootstrap 5, ng-bootstrap, ApexCharts, Feather icons, pages d'erreur 404/500 et pages d'auth (à rebrancher sur notre API).
- [ ] Supprimer du template : pages de démo (dashboard fictif, apps, UI kitchen-sink) — ne garder que ce qui sert de base de copie.
- [ ] `LOCALE_ID = 'fr-FR'` + `registerLocaleData(localeFr)` ; titre appli « ERP OpenInformatique ».
- [ ] **Environnements** : `environment.apiUrl = '/api/v1'` (dev et prod servis derrière le même host) + `proxy.conf.json` en dev :
  ```json
  { "/api": { "target": "http://localhost:3000", "secure": false } }
  ```
  Le proxy évite tout problème CORS/cookie en dev (même origine apparente). En déploiement séparé : renseigner `APP_CORS_ORIGINS` côté back et `apiUrl` absolu côté front.

### Arborescence cible

```
src/app/
  core/            # api/ (services HTTP), auth/ (store, guards, interceptors), models/
  shared/          # composants, pipes, directives réutilisables
  layout/          # layout NobleUI adapté (sidebar, navbar)
  features/        # une feature par spec : users/, contacts/, catalogue/, stock/, quotes/, orders/, invoices/, payments/, dashboard/, search/, audit/
```

---

## 2 · Couche HTTP & enveloppe

- [ ] Créer `core/models/api.model.ts` :
  ```ts
  export interface ApiEnvelope<T> {
    success: boolean;
    data: T;
    meta: { requestId?: string; pagination?: PaginationMeta };
  }
  export interface ApiError {
    code: string;          // ex. BUSINESS_RULE_VIOLATION, VALIDATION_ERROR…
    message: string;       // message français, affichable tel quel
    details?: { field: string; message: string }[];
  }
  export interface PaginationMeta {
    page: number; limit: number; totalItems: number;
    totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean;
  }
  export interface Page<T> { items: T[]; pagination: PaginationMeta; }
  ```
- [ ] Créer `core/api/api-client.service.ts` — wrapper typé de `HttpClient` qui **déplie l'enveloppe** :
  - `get<T>(url, params?)` → `Observable<T>` (renvoie `data`) ;
  - `getPage<T>(url, params?)` → `Observable<Page<T>>` (renvoie `data` + `meta.pagination`) ;
  - `post/patch/delete<T>(...)` ;
  - `download(url, params?)` → `Observable<{ blob: Blob; filename: string }>` (réponse binaire : `responseType: 'blob'`, `observe: 'response'`, nom extrait de `Content-Disposition`) — **utilisé par tous les exports** ;
  - les `params` `undefined`/`''` ne sont PAS envoyés (le back distingue « absent » de « vide »).
- [ ] Helper `shared/utils/file-download.ts` : `saveBlob(blob, filename)` (ancre temporaire + `URL.createObjectURL`).

---

## 3 · Authentification

### 3.1 · Store (signals)

- [ ] Créer `core/auth/auth.store.ts` (service `providedIn: 'root'`) :
  - signaux : `accessToken` (mémoire UNIQUEMENT — jamais localStorage), `currentUser` (`{ id, email, displayName, role }`), computed `isAuthenticated`, `isAdmin`, `isManagerOrAdmin` ;
  - `login(email, password)` → `POST /auth/login` (réponse : `{ accessToken, accessTokenExpiresAt, user }` ; le refresh token part en cookie HttpOnly `path=/api/v1/auth`, invisible au JS) ;
  - `refresh()` → `POST /auth/refresh` avec `withCredentials: true` (réponse : `{ accessToken, accessTokenExpiresAt }`) ;
  - `logout()` → `POST /auth/logout` (204, efface le cookie) puis purge du store + redirection `/auth/login` ;
  - `bootstrap()` (appelé au démarrage via `provideAppInitializer`) : tente `refresh()` puis `GET /auth/me` — si OK, session restaurée sans re-login ; sinon, état déconnecté silencieux.

### 3.2 · Intercepteurs (fonctionnels, ordre : token → refresh → erreurs)

- [ ] `authTokenInterceptor` : ajoute `Authorization: Bearer <accessToken>` sur les appels `/api/v1/*` (sauf `/auth/login` et `/auth/refresh`) ; force `withCredentials: true` sur `/auth/*`.
- [ ] `refreshInterceptor` : sur **401** (hors login/refresh) → un seul `refresh()` partagé (les requêtes concurrentes attendent la même promesse), rejeu de la requête d'origine ; si le refresh échoue → purge du store + redirection `/auth/login?returnUrl=…`.
- [ ] `apiErrorInterceptor` : mappe `error.error.error` (`ApiError`) vers des **toasts** NobleUI :
  - `VALIDATION_ERROR` → toast warning + les `details` renvoyés aux formulaires appelants ;
  - `BUSINESS_RULE_VIOLATION` (409) / `EXPORT_TOO_LARGE` (422) → toast erreur avec le message back TEL QUEL (ils sont rédigés pour l'utilisateur) ;
  - `ACCESS_DENIED` (403) → toast « Droits insuffisants » ;
  - `RESOURCE_NOT_FOUND` (404) sur navigation directe → page 404 ;
  - `TOO_MANY_REQUESTS` (429) → toast dédié (throttling login : 5/min) ;
  - 5xx → toast générique + `requestId` affiché (corrélation avec les logs back).

### 3.3 · Pages & guards

- [ ] Page `/auth/login` (layout auth NobleUI) : e-mail + mot de passe, erreurs inline, spinner, redirection `returnUrl` ou route d'atterrissage du rôle (ADMIN/MANAGER → `/dashboard`, EMPLOYEE → `/quotes`).
- [ ] `authGuard` (CanActivate) : redirige vers `/auth/login?returnUrl=…` si non authentifié.
- [ ] `roleGuard` : lit `route.data.roles: UserRole[]` ; refus → redirection page 403 (page NobleUI). Appliqué sur les routes listées dans chaque spec.

---

## 4 · Layout & navigation

- [ ] Adapter la **sidebar NobleUI** — entrées filtrées par rôle (computed sur `currentUser`) :

| Entrée | Route | Rôles |
|---|---|---|
| Tableau de bord | `/dashboard` | ADMIN, MANAGER |
| Contacts | `/contacts` | tous |
| Catalogue (Produits, Catégories) | `/products`, `/categories` | tous |
| Stocks (Niveaux, Mouvements, Entrepôts) | `/stock`, `/stock/movements`, `/warehouses` | tous (mouvements : A/M) |
| Devis | `/quotes` | tous |
| Commandes | `/orders` | tous |
| Factures & avoirs | `/invoices` | tous |
| Paiements / Impayés | `/payments`, `/payments/overdue` | ADMIN, MANAGER |
| Utilisateurs | `/users` | ADMIN, MANAGER |
| Journal d'audit | `/audit-logs` | ADMIN |

- [ ] Navbar : recherche globale (spec F06), menu profil (nom + rôle, liens Profil / Sessions / Déconnexion).
- [ ] Routes en **lazy loading** par feature (`loadChildren`/`loadComponent`) ; route `**` → 404 NobleUI.

---

## 5 · Modèles & composants partagés

- [ ] `core/models/enums.ts` — miroir EXACT des enums back (mêmes valeurs chaînes) : `UserRole`, `ContactType`, `ProductType`, `ProductUnit`, `StockMovementType`, `QuoteStatus`, `OrderType`, `OrderStatus`, `InvoiceType`, `InvoiceStatus`, `PaymentMethod`, `AuditCategory`, `SearchResultType`, `ExportFormat` + dictionnaires de **libellés français** (`ORDER_STATUS_LABELS['IN_PROGRESS'] = 'En livraison'`, etc.).
- [ ] `shared/components/status-badge` : `<app-status-badge [status]>` — badge Bootstrap coloré par statut (DRAFT gris, SENT bleu, ACCEPTED/PAID/DELIVERED vert, REJECTED/CANCELLED rouge, EXPIRED/OVERDUE orange, PARTIALLY_PAID jaune, IN_PROGRESS cyan).
- [ ] `shared/components/pagination` : branché sur `PaginationMeta` (état NobleUI/ng-bootstrap), émet `pageChange`.
- [ ] `shared/components/list-toolbar` : recherche (debounce 300 ms), slots filtres, bouton export optionnel.
- [ ] `shared/components/confirm-modal` : service `confirm(title, message, danger?)` → `Promise<boolean>` (ng-bootstrap) — utilisé avant toute suppression/transition irréversible.
- [ ] `shared/components/empty-state`, `shared/components/page-loader` (skeleton/spinner NobleUI).
- [ ] Pipes : `money` (EUR fr-FR), `dateFr` (`dd/MM/yyyy`), `dateTimeFr`.

---

## 6 · Règles UI transverses

| Règle | Détail |
|-------|--------|
| Token | Access token en mémoire (signal) — jamais localStorage/sessionStorage ; le cookie HttpOnly porte la persistance |
| Enveloppe | Dépliée par `ApiClient` : les composants ne manipulent jamais `success`/`meta` bruts |
| Erreurs métier | Les messages back (français) sont affichés tels quels — le front ne les réécrit pas |
| Calculs | AUCUN calcul métier front (totaux, statuts, reste à payer) : affichage des valeurs API uniquement |
| RBAC | Boutons/menus masqués par rôle via `@if (auth.isAdmin())` — le back reste l'autorité (403 toléré et géré) |
| Listes | Toute liste = pagination serveur + tri serveur (`sortBy`/`sortDirection` de la liste blanche back) — jamais de tri client sur page partielle |
| Requêtes | Paramètres vides non envoyés ; recherches debouncées 300 ms ; annulation des requêtes obsolètes (`switchMap`) |

---

## 7 · Tests

- [ ] **Unit** : `ApiClient` — dépliage enveloppe, extraction filename du `Content-Disposition`
- [ ] **Unit** : `refreshInterceptor` — 401 → un seul refresh pour N requêtes concurrentes, rejeu, échec → login
- [ ] **Unit** : `roleGuard` — matrice rôle × route
- [ ] **E2E** : login admin seedé → sidebar complète ; login employee → entrées restreintes, atterrissage `/quotes`
- [ ] **E2E** : expiration access token simulée → refresh silencieux sans perte de contexte
