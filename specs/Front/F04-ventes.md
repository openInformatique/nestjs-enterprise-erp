# F04 · Ventes — Devis & Commandes

> **Dépendances** : F00 (socle), F02 (contact-picker), F03 (product-picker, warehouse-select)
> **Modules back couverts** : 05 (devis), 06 (commandes) + export & historique (10)

---

## Contexte

Le cœur commercial : les devis (documents à lignes, cycle de vie strict, conversion en commande) et les commandes (clients ET fournisseurs, transitions qui pilotent le stock, facturation). Les deux partagent la même mécanique d'ÉDITEUR DE LIGNES — à construire une fois, en composant réutilisable — et la même logique de BOUTONS DE TRANSITION conditionnés par statut + rôle.

**Principe non négociable** : les totaux affichés viennent TOUJOURS de l'API (création/modification renvoient le document recalculé). L'éditeur peut afficher un « total indicatif » pendant la saisie, clairement marqué comme tel, mais la valeur de référence est la réponse serveur.

---

## 1 · Appels back

### Devis

| Méthode & route | Corps / query | Rôle | Usage front |
|---|---|---|---|
| `GET /quotes` | `page, limit, sortBy, sortDirection, search, status?, customerId?, from?, to?` | tous | Liste |
| `GET /quotes/:id` | — (lignes incluses) | tous | Détail |
| `POST /quotes` | `{ customerId, validUntil?, notes?, lines: [{ productId?, description?, quantity, unitPrice?, vatRate?, discountPercent? }] }` | tous | Création (DRAFT, n° `DEV-YYYY-NNNN`) |
| `PATCH /quotes/:id` | mêmes champs — `lines` = REMPLACEMENT COMPLET | ADMIN, MANAGER | Édition (DRAFT uniquement, 409 sinon) |
| `DELETE /quotes/:id` | — (204) | ADMIN | Suppression (DRAFT uniquement) |
| `POST /quotes/:id/send` | — (200) | ADMIN, MANAGER | DRAFT → SENT |
| `POST /quotes/:id/accept` | — (200) | ADMIN, MANAGER | SENT → ACCEPTED |
| `POST /quotes/:id/reject` | — (200) | ADMIN, MANAGER | SENT → REJECTED |
| `POST /quotes/:id/convert` | — (**201**, renvoie la COMMANDE) | ADMIN, MANAGER | ACCEPTED → commande CUSTOMER (une seule fois) |

### Commandes

| Méthode & route | Corps / query | Rôle | Usage front |
|---|---|---|---|
| `GET /orders` | `page, limit, sortBy, sortDirection, search, type?, status?, contactId?, from?, to?` | tous | Liste |
| `GET /orders/:id` | — | tous | Détail |
| `POST /orders` | `{ type, contactId, notes?, expectedDeliveryDate?, lines: [{ productId?, description?, quantity, unitPrice?, vatRate? }] }` (pas de remise) | ADMIN, MANAGER | Création (`CMD-`/`CDF-`) |
| `PATCH /orders/:id` | champs optionnels SANS `type` | ADMIN, MANAGER | Édition (DRAFT ou CONFIRMED) |
| `DELETE /orders/:id` | — (204) | ADMIN | Suppression (DRAFT) |
| `POST /orders/:id/confirm` | — (200) | ADMIN, MANAGER | DRAFT → CONFIRMED |
| `POST /orders/:id/start` | `{ warehouseId? }` (200) — requis si lignes stockées (CUSTOMER) ; 409 stock insuffisant | **tous** | CONFIRMED → IN_PROGRESS (sortie stock) |
| `POST /orders/:id/complete` | `{ warehouseId? }` (200) — requis si SUPPLIER avec lignes stockées | **tous** | IN_PROGRESS → DELIVERED (entrée stock) |
| `POST /orders/:id/cancel` | — (200) — réinjection stock si parti en livraison | ADMIN, MANAGER | → CANCELLED (sauf DELIVERED) |
| `POST /orders/:id/invoice` | — (**201**, renvoie la FACTURE) | ADMIN, MANAGER | CUSTOMER + DELIVERED → facture (une seule fois) |
| `GET /orders/export` | `format, type?, status?, contactId?, search?, from?, to?` → blob | ADMIN, MANAGER | Export |
| `GET /orders/:id/history` | pagination | tous | Onglet historique (F06) |

## 2 · Services API & modèles

- [ ] `quotes-api.service.ts`, `orders-api.service.ts` (une méthode par ligne des tableaux ci-dessus ; `convert()` typé `Order`, `invoice()` typé `Invoice`).
- [ ] Modèles : `Quote`/`QuoteLine` (avec `discountPercent`, `subtotalHT`), `Order`/`OrderLine` (sans remise, avec `quoteId`, `warehouseId`, `expectedDeliveryDate`, `deliveredAt`) + enums de statuts et libellés FR (devis : Brouillon/Envoyé/Accepté/Refusé/Expiré ; commandes : Brouillon/Confirmée/En livraison/Livrée/Annulée).

## 3 · Composant partagé : l'éditeur de lignes

- [ ] Créer `shared/components/line-editor` — `FormArray` de lignes, configurable `[withDiscount]` (devis : oui ; commandes/factures : non) :
  - chaque ligne : **produit** (product-picker, optionnel) OU **ligne libre** ; si produit choisi → description/prix/TVA pré-remplis depuis le catalogue mais MODIFIABLES (le back copie ses propres valeurs si champs absents — on envoie ce que l'utilisateur voit) ; si ligne libre → description + prix unitaire requis (validation front miroir du 409 back) ;
  - colonnes : produit/description, quantité (> 0, 2 déc.), PU HT, TVA (select 0/5.5/10/20), [remise %], sous-total indicatif ; boutons ajouter/supprimer/réordonner ;
  - pied : totaux INDICATIFS (HT/TVA/TTC) calculés localement pour le confort de saisie, étiquetés « indicatif — le serveur fait foi » ;
  - au moins 1 ligne (miroir `ArrayMinSize`).

## 4 · Pages — Devis

### `/quotes` — liste

- [ ] Table : numéro, client, statut (badge), validité (`validUntil`, rouge si dépassée), total TTC, créé le. Filtres : statut, client (contact-picker `type=CUSTOMER|BOTH`), période, recherche (n°/client). Bouton « Nouveau devis » (tous les rôles).

### `/quotes/:id` — détail

- [ ] En-tête : numéro, badge statut, client, dates ; totaux HT/TVA/TTC (API). Table des lignes (lecture) avec remises et sous-totaux.
- [ ] **Barre d'actions conditionnée statut × rôle** :

| Statut | Actions visibles |
|---|---|
| DRAFT | Modifier (A/M) · Envoyer (A/M) · Supprimer (ADMIN, confirm) |
| SENT | Accepter (A/M) · Refuser (A/M, confirm) |
| ACCEPTED | **Convertir en commande** (A/M — succès 201 → navigation `/orders/:id` de la commande créée ; 409 « déjà converti » toléré) |
| REJECTED / EXPIRED | aucune (lecture seule) |

### `/quotes/new` · `/quotes/:id/edit`

- [ ] Client (contact-picker clients), validité (datepicker, défaut +30 j affiché à titre indicatif — champ vide = le back applique), notes, line-editor `[withDiscount]=true`. Édition accessible UNIQUEMENT si DRAFT (garde de route sur le statut chargé).

## 5 · Pages — Commandes

### `/orders` — liste

- [ ] Table : numéro (`CMD-`/`CDF-`), type (badge Client/Fournisseur), contact, statut, total TTC, livraison prévue, créé le. Filtres : type, statut, contact, période, recherche. Export (A/M). « Nouvelle commande » (A/M).

### `/orders/:id` — détail

- [ ] En-tête : numéro, badges type + statut, contact, lien vers le devis d'origine si `quoteId`, entrepôt logistique si posé, dates (prévue / livrée le).
- [ ] Onglets : **Lignes & totaux** · **Historique** (F06, tous).
- [ ] **Barre d'actions statut × rôle** :

| Statut | Actions |
|---|---|
| DRAFT | Modifier (A/M) · Confirmer (A/M) · Supprimer (ADMIN) · Annuler (A/M) |
| CONFIRMED | Modifier (A/M) · **Démarrer la livraison** (tous) · Annuler (A/M) |
| IN_PROGRESS | **Clôturer la livraison** (tous) · Annuler (A/M — avertir : le stock sorti sera réinjecté) |
| DELIVERED | **Facturer** (A/M, si type CUSTOMER et pas encore facturée — 409 toléré) |
| CANCELLED | aucune |

- [ ] **Modale « Démarrer la livraison »** : si commande CUSTOMER, warehouse-select (« entrepôt de sortie ») — soumission `{ warehouseId }` ; 409 (entrepôt manquant, stock insuffisant) affiché DANS la modale. Commande SUPPLIER ou sans ligne stockée : confirmation simple (body `{}`).
- [ ] **Modale « Clôturer »** : si SUPPLIER, warehouse-select (« entrepôt de réception ») ; sinon confirmation simple.
- [ ] **Facturer** : succès 201 → navigation `/invoices/:id` de la facture créée.

### `/orders/new` · `/orders/:id/edit`

- [ ] Création : type (radio Client/Fournisseur — IMMUABLE ensuite, absent du formulaire d'édition), contact (picker filtré par type choisi : CUSTOMER|BOTH ou SUPPLIER|BOTH), date de livraison prévue, notes, line-editor sans remise. Édition : DRAFT ou CONFIRMED uniquement.

## 6 · Règles UI

| Règle | Détail |
|-------|--------|
| Transitions | JAMAIS de logique de transition front au-delà du masquage : le clic appelle l'API et affiche le document renvoyé (statut à jour) ; tout 409 s'affiche tel quel |
| Totaux | Réponse serveur = vérité ; totaux locaux = « indicatif » (libellé visible) |
| Remise | Devis uniquement ; à la conversion, le back la fond dans le prix — la commande affiche donc des PU différents du devis : prévoir une note dans le détail commande si `quoteId` |
| Type de commande | Choisi à la création, jamais rééditable (le DTO back l'omet en PATCH) |
| start/complete pour tous | EMPLOYEE voit et utilise Démarrer/Clôturer (gestes de magasinier) mais pas Confirmer/Annuler |
| Expiration devis | Purement back (cron) : le front affiche EXPIRED, ne le calcule pas |

## 7 · Tests

- [ ] **Unit** : matrice statut × rôle → boutons visibles (devis et commandes)
- [ ] **Unit** : line-editor — ligne libre sans prix bloquée, totaux indicatifs
- [ ] **E2E** : devis → envoyer → accepter → convertir → la commande s'ouvre avec `quoteId` renseigné
- [ ] **E2E** : commande CUSTOMER avec produit stocké → start sans entrepôt = erreur dans la modale ; avec entrepôt = stock décrémenté (vérif écran `/stock`)
