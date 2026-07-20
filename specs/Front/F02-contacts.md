# F02 · Contacts (Clients & Fournisseurs)

> **Dépendances** : F00 (socle)
> **Module back couvert** : 02 (contacts) + export & historique (10)

---

## Contexte

Le référentiel clients/fournisseurs — la première feature « métier » et le PATRON des suivantes : liste paginée filtrable, fiche détail, formulaire création/édition, export CSV/XLSX, onglet historique. Les specs F03 à F05 répliquent cette structure.

---

## 1 · Appels back

| Méthode & route | Corps / query | Rôle | Usage front |
|---|---|---|---|
| `GET /contacts` | `page, limit, sortBy, sortDirection, search, type?, isActive?` | tous | Liste paginée |
| `GET /contacts/:id` | — | tous | Fiche |
| `POST /contacts` | `{ type, companyName, contactName?, email?, phone?, street?, city?, postalCode?, country?, siret?, vatNumber?, notes? }` | ADMIN, MANAGER | Création |
| `PATCH /contacts/:id` | mêmes champs, tous optionnels | ADMIN, MANAGER | Édition |
| `DELETE /contacts/:id` | — (204, soft delete) | ADMIN | Désactivation |
| `GET /contacts/export` | `format (csv\|xlsx), type?, search?` → **blob** | ADMIN, MANAGER | Export (max 10 000 lignes, 422 au-delà) |
| `GET /contacts/:id/history` | `page, limit, sortDirection` | ADMIN, MANAGER | Onglet historique (composant partagé, F06) |

## 2 · Service API & modèles

- [ ] `core/api/contacts-api.service.ts` : `list(query)`, `getById(id)`, `create(dto)`, `update(id, dto)`, `remove(id)`, `export(format, filters)` (via `ApiClient.download`).
- [ ] `core/models/contact.model.ts` : `Contact` miroir de `ContactResponseDto` (`id, type, companyName, contactName, email, phone, street, city, postalCode, country, siret, vatNumber, notes, isActive, createdAt, updatedAt`).

## 3 · Pages

### `/contacts` — liste

- [ ] Table : société, contact, e-mail, téléphone, ville, type (badge : CUSTOMER vert « Client », SUPPLIER bleu « Fournisseur », BOTH violet « Client & fournisseur »), actif. Tri serveur sur les colonnes de la liste blanche back (`companyName`, `type`, `city`, `createdAt`…).
- [ ] Toolbar : recherche (société / e-mail / nom du contact), filtre type, filtre actif, bouton **Exporter** (A/M — menu CSV/XLSX, reprend les filtres courants SANS pagination), bouton « Nouveau contact » (A/M).
- [ ] Clic ligne → fiche.

### `/contacts/:id` — fiche

- [ ] En-tête : société, badges type + actif ; actions Modifier (A/M), Désactiver (ADMIN, confirm DANGER).
- [ ] Onglets : **Informations** (coordonnées, SIRET/TVA, notes) · **Historique** (`<app-audit-history resourceType="contact" [resourceId]>`, A/M — affiche l'état « aucun événement » tant que l'instrumentation audit back n'est pas faite, cf. F06).

### `/contacts/new` · `/contacts/:id/edit` — formulaire

- [ ] Reactive form typé : type (radio 3 choix), société (requis), contact, e-mail (validator), téléphone, adresse (rue/ville/CP/pays — pays défaut `FR`, code ISO 2 lettres), SIRET (14 chiffres si renseigné), TVA intracom, notes (textarea).
- [ ] `VALIDATION_ERROR` back → erreurs mappées champ à champ via `details[]`.

## 4 · Règles UI

| Règle | Détail |
|-------|--------|
| Type immuable ? | Non — le type reste modifiable (le back l'accepte) ; prévenir visuellement si le contact est utilisé ailleurs n'est PAS fait au niveau mini |
| Suppression | = désactivation (soft) : le contact disparaît des listes par défaut, filtre `isActive=false` pour le retrouver |
| Export | Toujours les filtres courants de la liste ; 422 `EXPORT_TOO_LARGE` → toast back tel quel |
| Sélecteur réutilisable | Prévoir `shared/components/contact-picker` (typeahead sur `GET /contacts?search=&type=`) — réutilisé par F04 (devis/commandes) et F05 (factures) |

## 5 · Tests

- [ ] **Unit** : mapping `VALIDATION_ERROR.details` → erreurs de formulaire
- [ ] **E2E** : création contact → visible en liste → export CSV contient la ligne
- [ ] **E2E** : EMPLOYEE ne voit ni « Nouveau contact » ni « Exporter »
