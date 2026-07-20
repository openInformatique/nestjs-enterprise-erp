# F05 · Facturation & Paiements

> **Dépendances** : F00 (socle), F02 (contact-picker), F03 (product-picker), F04 (line-editor)
> **Modules back couverts** : 07 (factures & avoirs), 08 (paiements) + export & historique (10)

---

## Contexte

Le volet financier : les factures et avoirs (documents légaux — une facture émise ne se modifie plus JAMAIS, elle se corrige par avoir), les encaissements (qui font vivre `paidAmount` et les statuts PARTIALLY_PAID/PAID automatiquement côté back) et l'écran des impayés. L'UI doit rendre la RÈGLE D'OR visible : après émission, plus aucun bouton de modification — seuls avoir et encaissement restent.

---

## 1 · Appels back

### Factures & avoirs

| Méthode & route | Corps / query | Rôle | Usage front |
|---|---|---|---|
| `GET /invoices` | `page, limit, sortBy, sortDirection, search, type?, status?, customerId?, from?, to?` (dates = ÉMISSION) | tous | Liste |
| `GET /invoices/:id` | — (lignes + `paidAmount` + `remainingAmount` calculé) | tous | Détail |
| `POST /invoices` | `{ customerId, dueDate?, notes?, lines: [{ productId?, description?, quantity, unitPrice?, vatRate? }] }` (échéance défaut +30 j) | ADMIN, MANAGER | Facture manuelle (DRAFT, `FAC-YYYY-NNNN`) |
| `PATCH /invoices/:id` | champs optionnels | ADMIN, MANAGER | Édition (DRAFT uniquement) |
| `DELETE /invoices/:id` | — (204) | ADMIN | Suppression (DRAFT uniquement) |
| `POST /invoices/:id/send` | — (200) | ADMIN, MANAGER | DRAFT → SENT (**point de non-retour**) |
| `POST /invoices/:id/cancel` | — (200) | ADMIN, MANAGER | DRAFT/SENT → CANCELLED (payée = interdit, 409) |
| `POST /invoices/:id/credit-note` | `{ lines?, notes? }` (**201**) — sans `lines` = avoir TOTAL, avec = PARTIEL | ADMIN, MANAGER | Crée l'avoir `AV-YYYY-NNNN` lié (`creditNoteForId`) |
| `GET /invoices/export` | `format, type?, status?, customerId?, search?, from?, to?` → blob | ADMIN, MANAGER | Export |
| `GET /invoices/:id/history` | pagination | tous | Onglet historique (F06) |

### Paiements

| Méthode & route | Corps / query | Rôle | Usage front |
|---|---|---|---|
| `GET /payments` | `page, limit, sortBy, sortDirection, invoiceId?, method?, from?, to?` (dates = VALEUR) | ADMIN, MANAGER | Liste des encaissements |
| `GET /payments/:id` | — | ADMIN, MANAGER | Détail |
| `POST /payments` | `{ invoiceId, amount, method, reference?, notes?, paidAt? }` — 409 si facture non encaissable ou montant > solde | ADMIN, MANAGER | Encaissement (statut facture recalculé back) |
| `DELETE /payments/:id` | — (204) — statut facture recorrigé back | ADMIN | Suppression (saisie erronée) |
| `GET /payments/overdue` | `page, limit` → résumé impayés `{ invoiceId, invoiceNumber, customer{ id, companyName, email }, totalTTC, paidAmount, remainingAmount, dueDate, daysOverdue, payments[] }` | ADMIN, MANAGER | Écran impayés |
| `GET /payments/export` | `format, invoiceId?, method?, from?, to?` → blob | ADMIN, MANAGER | Export |
| `GET /payments/:id/history` | pagination | ADMIN, MANAGER | Historique (F06) |

## 2 · Services API & modèles

- [ ] `invoices-api.service.ts`, `payments-api.service.ts`.
- [ ] Modèles : `Invoice`/`InvoiceLine` (`type INVOICE|CREDIT_NOTE`, `orderId`, `creditNoteForId`, `issueDate`, `dueDate`, `paidAmount`, `remainingAmount`, `pdfUrl` — toujours null au niveau mini), `Payment` (`method`, `reference`, `paidAt`, `recordedBy`), `OverdueInvoiceSummary` + libellés FR (statuts factures : Brouillon/Émise/Partiellement payée/Payée/En retard/Annulée ; méthodes : Virement/Carte/Espèces/Chèque/Autre).

## 3 · Pages — Factures & avoirs

### `/invoices` — liste

- [ ] Table : numéro (`FAC-`/`AV-`), type (badge Facture / Avoir violet), client, statut, émise le, échéance (rouge si dépassée et non soldée), total TTC, **reste à payer**. Filtres : type, statut, client, période d'émission, recherche. Export (A/M). « Nouvelle facture » (A/M).

### `/invoices/:id` — détail

- [ ] En-tête : numéro, badges type + statut, client ; liens croisés : commande d'origine (`orderId`), facture corrigée (`creditNoteForId` — sur un avoir), avoirs liés (recherche inverse `GET /invoices?type=CREDIT_NOTE` filtrée client puis match `creditNoteForId` — au niveau mini : lien seulement depuis l'avoir vers sa source).
- [ ] Bloc financier : total TTC, **payé**, **reste à payer** (valeurs API, jamais recalculées), échéance + jours de retard éventuels.
- [ ] Onglets : **Lignes** · **Paiements** (`GET /payments?invoiceId=` — table + bouton « Encaisser », cf. § 4) · **Historique** (F06).
- [ ] **Barre d'actions statut × rôle** :

| Statut | Actions |
|---|---|
| DRAFT | Modifier (A/M) · **Émettre** (A/M, confirm : « plus aucune modification ensuite ») · Annuler (A/M) · Supprimer (ADMIN) |
| SENT / OVERDUE | **Encaisser** (A/M) · **Créer un avoir** (A/M) · Annuler (A/M — refusé 409 si un centime encaissé) |
| PARTIALLY_PAID | Encaisser · Créer un avoir |
| PAID | Créer un avoir |
| CANCELLED | aucune |
| type = CREDIT_NOTE | cycle réduit : DRAFT → Émettre/Annuler/Supprimer ; jamais Encaisser ni Avoir (« un avoir ne se corrige pas, on refacture ») |

- [ ] **Modale « Créer un avoir »** : choix Avoir TOTAL (copie de la source, body `{ notes? }`) ou PARTIEL (line-editor pré-rempli avec les lignes de la facture, éditable — prix FIGÉS proposés) ; succès 201 → navigation vers l'avoir créé.

### `/invoices/new` · `/invoices/:id/edit`

- [ ] Client (picker), échéance (datepicker — vide = +30 j back ; erreur 409 « antérieure à l'émission » gérée), notes, line-editor SANS remise. Édition : DRAFT uniquement.

## 4 · Pages — Paiements & impayés

### Modale « Encaisser » (ouverte depuis la facture ou l'écran impayés)

- [ ] Champs : montant (pré-rempli avec `remainingAmount`, max affiché), méthode (select), référence?, notes?, date de valeur? (défaut aujourd'hui). 409 (dépassement de solde, facture non encaissable) affiché dans la modale avec le message back (il contient le solde exact). Succès → toast + rechargement de la facture (statut possiblement PAID).

### `/payments` — liste (ADMIN, MANAGER)

- [ ] Table : date de valeur, facture (lien), montant, méthode (badge), référence, saisi le. Filtres : facture, méthode, période. Export (A/M). Suppression par ligne (ADMIN, confirm DANGER : « le statut de la facture sera recalculé »).

### `/payments/overdue` — impayés (ADMIN, MANAGER)

- [ ] Écran de relance, trié par reste à payer décroissant (ordre serveur) : facture (lien), client + **e-mail** (mailto), total / payé / **reste**, échéance, **jours de retard** (badge rouge si > 0), encaissements déjà reçus (sous-liste dépliable), bouton Encaisser par ligne.

## 5 · Règles UI

| Règle | Détail |
|-------|--------|
| Point de non-retour | Après SENT : plus aucun bouton Modifier/Supprimer, quel que soit le rôle — la correction est l'AVOIR |
| Montants | `paidAmount`/`remainingAmount` viennent de l'API ; le front ne soustrait jamais lui-même |
| Avoirs | Montants affichés en POSITIF avec badge « Avoir » (le type porte le sens, convention back) |
| OVERDUE | Posé par le cron back (02:00) : le front l'affiche, ne le déduit pas de `dueDate` (seul `daysOverdue` de l'écran impayés vient du back) |
| Paiement | Pas de bouton Encaisser sur DRAFT/CANCELLED/PAID ni sur un avoir |
| PDF | `pdfUrl` toujours null au niveau mini : aucun bouton PDF (viendra avec le min- back) |

## 6 · Tests

- [ ] **Unit** : matrice statut × type × rôle → actions visibles
- [ ] **E2E** : facture → émettre → encaissement partiel → badge PARTIALLY_PAID + reste à payer correct → solde → PAID
- [ ] **E2E** : avoir partiel depuis une facture émise → `AV-…` créé, lien vers la source
- [ ] **E2E** : suppression d'un paiement (ADMIN) → la facture redescend de statut (affichage rafraîchi)
