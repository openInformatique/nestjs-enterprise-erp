# Specs Front — ERP Angular (NobleUI)

Pendant front des specs back (`specs/01` à `10`) : un front Angular qui couvre **100 % des fonctionnalités exposées par l'API**.

## Stack retenue

| Brique | Choix |
|---|---|
| Framework | Angular (dernière version) — composants **standalone**, **signals**, nouveau control flow (`@if`/`@for`), `inject()` |
| UI | Template **NobleUI Angular** (ThemeForest) — Bootstrap 5, ng-bootstrap, ApexCharts, Feather icons |
| État & data | **Services + signals** — un service API par module back, état local par page ; pas de store global |
| Formulaires | Reactive Forms typés |
| Langue / formats | Interface en **français**, montants EUR (`1 094,76 €`), dates `dd/MM/yyyy` (`LOCALE_ID = fr-FR`) |
| Back | API NestJS de ce repo — `http://localhost:3000/api/v1`, enveloppe `{ success, data, meta }` |

## Les 7 specs

| Spec | Périmètre | Modules back couverts |
|---|---|---|
| [F00 · Socle front](F00-socle-front.md) | Projet, NobleUI, HTTP/enveloppe, auth (login, refresh, intercepteurs), guards, layout, modèles & composants partagés | 00 (socle), auth |
| [F01 · Utilisateurs & sessions](F01-utilisateurs-sessions.md) | Administration des comptes, profil, mot de passe, sessions actives | 01 |
| [F02 · Contacts](F02-contacts.md) | Clients & fournisseurs : liste, fiche, CRUD, export, historique | 02 |
| [F03 · Catalogue & stocks](F03-catalogue-stocks.md) | Catégories, produits, entrepôts, niveaux, mouvements, opérations de stock | 03, 04 |
| [F04 · Ventes](F04-ventes.md) | Devis (cycle de vie, conversion) & commandes (logistique, facturation) | 05, 06 |
| [F05 · Facturation & paiements](F05-facturation-paiements.md) | Factures, avoirs, encaissements, impayés | 07, 08 |
| [F06 · Dashboard & transversal](F06-dashboard-transversal.md) | Tableau de bord, recherche globale, journal d'audit, composant historique partagé | 09, 10 |

## Ordre d'implémentation suggéré

F00 → F01 → F02 → F03 → F04 → F05 → F06 — chaque spec suppose les précédentes terminées (comme les modules back). F00 est le prérequis absolu : rien ne fonctionne sans l'authentification et les intercepteurs.

## Conventions transverses (détaillées en F00)

- **Jamais de token en localStorage** : access token en mémoire (signal), persistance de session par le cookie HttpOnly de refresh (`withCredentials` sur `/auth/*`).
- **L'enveloppe est dépliée par la couche API** : les composants ne voient que `data` (et `meta.pagination` pour les listes).
- **Le back est la seule source de vérité métier** : le front n'implémente AUCUN calcul de totaux/statuts — il affiche ce que l'API renvoie et laisse les 409 remonter en toasts.
- **RBAC en miroir** : les boutons/menus sont masqués selon le rôle (`ADMIN` / `MANAGER` / `EMPLOYEE`), mais c'est le back qui fait autorité (un 403 reste géré proprement).
- **Rôles & atterrissage** : ADMIN/MANAGER arrivent sur `/dashboard` ; EMPLOYEE (pas d'accès dashboard) sur `/quotes`.
