# F03 · Catalogue & Stocks

> **Dépendances** : F00 (socle), F02 (patron liste/fiche + contact-picker non requis ici)
> **Modules back couverts** : 03 (catalogue), 04 (stocks) + export & historique (10)

---

## Contexte

Deux volets liés : le catalogue (catégories hiérarchiques + produits/services) et la logistique (entrepôts, niveaux de stock, journal des mouvements, opérations). Les opérations de stock sont des MODALES (pas des pages) : entrée, sortie, transfert, ajustement — chacune poste sur l'API et rafraîchit les niveaux.

---

## 1 · Appels back

### Catalogue

| Méthode & route | Corps / query | Rôle | Usage front |
|---|---|---|---|
| `GET /categories` | `isActive?` → liste **plate** (non paginée) | tous | Arbre reconstruit front via `parentId` |
| `GET /categories/:id` | — | tous | Détail |
| `POST /categories` | `{ name, description?, parentId? }` | ADMIN, MANAGER | Création |
| `PATCH /categories/:id` | `{ name?, description?, parentId?, isActive? }` | ADMIN, MANAGER | Édition |
| `DELETE /categories/:id` | — (204) | ADMIN | Désactivation |
| `GET /products` | `page, limit, sortBy, sortDirection, search, categoryId?, type?, isActive?` | tous | Liste paginée |
| `GET /products/:id` | — | tous | Fiche |
| `POST /products` | `{ name, type, unit, unitPrice, purchasePrice?, vatRate?, sku?, description?, categoryId?, imageUrl? }` (SKU auto `PROD-XXXX` si absent) | ADMIN, MANAGER | Création — 409 si SKU pris |
| `PATCH /products/:id` | mêmes champs optionnels | ADMIN, MANAGER | Édition |
| `DELETE /products/:id` | — (204, soft) | ADMIN | Désactivation |
| `GET /products/export` | `format, type?, categoryId?, search?` → **blob** | ADMIN, MANAGER | Export (catégorie résolue par nom côté back) |
| `GET /products/:id/history` | pagination | ADMIN, MANAGER | Onglet historique (F06) |

### Stocks

| Méthode & route | Corps / query | Rôle | Usage front |
|---|---|---|---|
| `GET /warehouses` | `isActive?` | tous | Liste des entrepôts |
| `GET /warehouses/:id` | — | tous | Détail |
| `POST /warehouses` | `{ name, code, street?, city? }` (code normalisé MAJUSCULES) | ADMIN | Création |
| `PATCH /warehouses/:id` | `{ name?, street?, city?, isActive? (true = réactivation uniquement) }` | ADMIN, MANAGER | Édition |
| `DELETE /warehouses/:id` | — (204 = désactivation ; 409 si stock non vide) | ADMIN | Désactivation |
| `GET /stock` | `page, limit, productId?, warehouseId?, lowStock?` → niveaux ENRICHIS `{ productId, productSku, productName, warehouseId, warehouseName, quantity, updatedAt }` | tous | Écran niveaux |
| `GET /stock/movements` | `page, limit, productId?, warehouseId?, type?, from?, to?, search?` | ADMIN, MANAGER | Journal des mouvements |
| `POST /stock/in` | `{ productId, warehouseId, quantity, unitCost?, reference?, notes? }` | tous | Modale Entrée |
| `POST /stock/out` | `{ productId, warehouseId, quantity, reference?, notes? }` — 409 si stock insuffisant | tous | Modale Sortie |
| `POST /stock/transfer` | `{ productId, fromWarehouseId, toWarehouseId, quantity, notes? }` | ADMIN, MANAGER | Modale Transfert |
| `POST /stock/adjust` | `{ productId, warehouseId, newQuantity, notes (OBLIGATOIRE) }` — cible absolue, pas un delta | ADMIN, MANAGER | Modale Ajustement |

## 2 · Services API & modèles

- [ ] `categories-api.service.ts`, `products-api.service.ts`, `warehouses-api.service.ts`, `stock-api.service.ts` (mêmes conventions que F02).
- [ ] Modèles : `Category`, `Product` (avec enums `ProductType`, `ProductUnit`), `Warehouse`, `StockLevel` (vue enrichie), `StockMovement` (`type, quantity, unitCost, reference, notes, performedBy, performedAt, warehouse(s)`).
- [ ] `shared/components/product-picker` : typeahead sur `GET /products?search=&isActive=true` (affiche SKU + nom + prix) — réutilisé par F04/F05 et les modales de stock. Variante `[stockedOnly]=true` (filtre `type=PRODUCT`).
- [ ] `shared/components/warehouse-select` : select des entrepôts actifs — réutilisé par F04 (start/complete).

## 3 · Pages — Catalogue

### `/categories`

- [ ] Vue arborescente (liste plate → arbre par `parentId`, composant récursif) avec badge inactif ; actions par nœud : renommer/éditer (A/M), désactiver (ADMIN), « Nouvelle sous-catégorie » (A/M). Création racine par bouton toolbar.

### `/products` — liste

- [ ] Table : SKU, nom, type (badge Produit/Service), catégorie (nom résolu via le cache `GET /categories`), prix de vente HT (`money`), TVA, unité, actif. Toolbar : recherche SKU/nom, filtres catégorie (select arbre) / type / actif, Export (A/M), « Nouveau produit » (A/M).

### `/products/:id` — fiche

- [ ] En-tête : nom, SKU, badges type/actif, image si `imageUrl`. Actions : Modifier (A/M), Désactiver (ADMIN).
- [ ] Onglets : **Informations** (prix vente/achat, TVA, unité, catégorie, description) · **Stock** (niveaux de CE produit : `GET /stock?productId=` — par entrepôt, mis en évidence si bas) · **Historique** (F06, A/M).

### `/products/new` · `/products/:id/edit`

- [ ] Formulaire : nom (requis), type (radio Produit/Service — à la création uniquement, désactivé en édition si des mouvements existent ? NON : le back l'accepte, on laisse), unité (select `ProductUnit` avec libellés français), prix de vente HT (requis, ≥ 0, 2 déc.), prix d'achat HT, TVA (select 0/5.5/10/20), SKU (optionnel, placeholder « auto »), catégorie (select), description, URL image.

## 4 · Pages — Stocks

### `/stock` — niveaux

- [ ] Table : produit (SKU + nom), entrepôt, quantité (rouge si < 5 — cohérent avec `lowStock`), mis à jour le. Filtres : produit (picker), entrepôt (select), toggle « Stocks bas uniquement » (`lowStock=true`).
- [ ] Toolbar : boutons **Entrée** / **Sortie** (tous), **Transfert** / **Ajustement** (A/M) → modales.

### Modales d'opération (4)

- [ ] **Entrée** : produit (stockedOnly), entrepôt, quantité (entier > 0), coût unitaire HT?, référence?, notes?.
- [ ] **Sortie** : produit, entrepôt, quantité, référence?, notes? — 409 « stock insuffisant » affiché tel quel dans la modale.
- [ ] **Transfert** : produit, entrepôt source ≠ destination (validation front), quantité, notes?.
- [ ] **Ajustement** : produit, entrepôt, **nouvelle quantité comptée** (libellé explicite : cible absolue), notes OBLIGATOIRES (motif d'inventaire).
- [ ] Après succès : toast + rafraîchissement de la liste des niveaux (et du journal si affiché).

### `/stock/movements` — journal (ADMIN, MANAGER)

- [ ] Table immuable (aucune action) : date, type (badge IN vert / OUT rouge / TRANSFER bleu / ADJUSTMENT orange), produit, entrepôt (+ destination si transfert), quantité, coût unitaire, référence, notes. Filtres : produit, entrepôt, type, période `from`/`to`, recherche (référence — ex. `ANNULATION CMD-…`).

### `/warehouses`

- [ ] Table : code, nom, ville, actif. Création (ADMIN), édition (A/M), désactivation (ADMIN — le 409 back « stock non vide » s'affiche tel quel), réactivation via édition (`isActive: true`).

## 5 · Règles UI

| Règle | Détail |
|-------|--------|
| Quantités | Entiers uniquement dans TOUTES les modales de stock (le stock back est en entiers) |
| Ajustement | Toujours « quantité comptée », jamais « delta » — le libellé du champ doit l'expliciter |
| Journal | Lecture seule absolue : aucune édition/suppression de mouvement n'existe (écriture compensatrice côté back) |
| Services | Un produit SERVICE n'apparaît jamais dans les pickers de stock (`stockedOnly`) |
| Cache catégories | La liste plate `GET /categories` est mise en cache session (signal) et invalidée après CRUD catégorie |

## 6 · Tests

- [ ] **Unit** : reconstruction de l'arbre catégories depuis la liste plate
- [ ] **E2E** : entrée 10 → sortie 3 → niveau 7 affiché ; sortie 100 → 409 toast, niveau inchangé
- [ ] **E2E** : transfert entre 2 entrepôts → 2 lignes (ou 1 TRANSFER) au journal, niveaux cohérents
