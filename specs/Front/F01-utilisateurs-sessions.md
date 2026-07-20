# F01 · Utilisateurs & Sessions

> **Dépendances** : F00 (socle, auth, guards)
> **Module back couvert** : 01 (users) + endpoints sessions du socle auth

---

## Contexte

L'administration des comptes (réservée ADMIN pour l'écriture, ADMIN/MANAGER pour la lecture), le profil de l'utilisateur connecté et la gestion de ses sessions actives. C'est la première feature : elle valide le socle F00 de bout en bout (liste paginée, formulaires, RBAC, modales).

---

## 1 · Appels back

| Méthode & route | Corps / query | Rôle | Usage front |
|---|---|---|---|
| `GET /users` | `page, limit, sortBy, sortDirection, search, role?, isActive?` | ADMIN, MANAGER | Liste paginée |
| `GET /users/:id` | — | ADMIN, MANAGER | Fiche utilisateur |
| `POST /users` | `{ email, password, displayName, role? }` (défaut EMPLOYEE) | ADMIN | Création — 409 `RESOURCE_ALREADY_EXISTS` si e-mail pris |
| `PATCH /users/:id/role` | `{ role }` | ADMIN | Changement de rôle — 409 sur soi-même ou dernier ADMIN actif |
| `DELETE /users/:id` | — (204) | ADMIN | Désactivation (soft) — 409 sur soi-même |
| `PATCH /users/:id/reactivate` | — | ADMIN | Réactivation (idempotent) |
| `GET /users/me` | — | tous | Page profil |
| `PATCH /users/me/password` | `{ currentPassword, newPassword }` (204) | tous | Changement de mot de passe — 409 si mdp actuel incorrect |
| `GET /auth/sessions` | — | tous | Sessions actives (`isCurrent` marque la session en cours) |
| `DELETE /auth/sessions/:id` | — (204) | tous | Révocation d'une session (les siennes uniquement) |
| `POST /auth/logout-all` | — → `{ revokedSessions }` | tous | Déconnexion globale |

## 2 · Service API

- [ ] Créer `core/api/users-api.service.ts` : `list(query)`, `getById(id)`, `create(dto)`, `changeRole(id, role)`, `deactivate(id)`, `reactivate(id)`, `me()`, `changeMyPassword(dto)`.
- [ ] Créer `core/api/sessions-api.service.ts` : `list()`, `revoke(id)`, `logoutAll()`.
- [ ] Modèles `core/models/user.model.ts` : `User { id, email, displayName, role, isActive, createdAt, updatedAt }`, `Session { id, userAgent, ipAddress, lastUsedAt, expiresAt, createdAt, isCurrent }`.

## 3 · Pages

### `/users` — liste (ADMIN, MANAGER)

- [ ] Table NobleUI : e-mail, nom affiché, rôle (badge : ADMIN rouge, MANAGER bleu, EMPLOYEE gris), actif (badge), créé le. Toolbar : recherche, filtres rôle + statut (`isActive`), bouton « Nouvel utilisateur » (ADMIN).
- [ ] Ligne : actions (ADMIN uniquement) — changer le rôle (modale avec select), désactiver (confirm-modal DANGER) ou réactiver selon l'état. Les comptes désactivés apparaissent grisés (filtre `isActive=false`).
- [ ] Sur soi-même : actions rôle/désactivation masquées (le back refuserait en 409 — on n'offre pas le bouton).

### `/users/new` — création (ADMIN)

- [ ] Formulaire réactif : e-mail (validators email), mot de passe (min 12 + indicateur de force, cf. règles back), nom affiché, rôle (select, défaut EMPLOYEE). 409 e-mail déjà pris → erreur inline sur le champ.

### `/profile` — mon profil (tous)

- [ ] Carte identité (e-mail, nom, rôle) + formulaire « Changer mon mot de passe » (`currentPassword`, `newPassword`, confirmation front). 409 → erreur inline « Mot de passe actuel incorrect ». Succès → toast + suggestion de reconnexion.

### `/profile/sessions` — mes sessions (tous)

- [ ] Table : appareil (`userAgent` résumé), IP, dernière activité, expire le, badge « Session courante » sur `isCurrent`.
- [ ] Révocation par ligne (désactivée sur la session courante — utiliser Déconnexion) ; bouton « Déconnecter toutes mes sessions » (confirm DANGER) → `logout-all` → retour login.

## 4 · Règles UI

| Règle | Détail |
|-------|--------|
| Rôles | Écriture ADMIN ; lecture liste A/M ; profil/sessions pour tous — `roleGuard` + masquage boutons |
| Auto-protection | Jamais de bouton rôle/désactivation sur son propre compte |
| Dernier ADMIN | Le 409 back (« dernier ADMIN actif ») s'affiche tel quel — pas de pré-calcul front |
| Mot de passe | Un admin ne change JAMAIS le mot de passe d'autrui (aucun UI pour ça — l'API n'existe pas) |

## 5 · Tests

- [ ] **Unit** : masquage des actions sur soi-même
- [ ] **E2E** : création utilisateur → login avec ce compte → sidebar EMPLOYEE
- [ ] **E2E** : révocation d'une session → la session révoquée reçoit 401 puis redirige login
