# Tests

## Trois niveaux

| Niveau | Emplacement | Base de données | Commande |
| --- | --- | --- | --- |
| Unitaires | `src/**/*.spec.ts` (à côté du code) | aucune (mocks) | `npm run test:unit` |
| Intégration | `test/integration/*.integration-spec.ts` | `nestjs_starter_test` | `npm run test:integration` |
| End-to-end | `test/e2e/*.e2e-spec.ts` | `nestjs_starter_test` | `npm run test:e2e` |

`npm test` exécute les trois suites. `npm run test:cov` produit la couverture
(informative : aucun seuil bloquant, choix assumé du socle).

## Prérequis intégration / e2e

1. conteneur SQL Server démarré (`npm run docker:db:up`) ;
2. `.env.test` présent (copie de `.env.test.example`, même `DB_PASSWORD` que
   `.env.local`) ;
3. base créée (`npm run db:init`).

Les suites chargent `.env.test` automatiquement (setup Jest) et REFUSENT de
s'exécuter si `DB_DATABASE` ne se termine pas par `_test` — impossible de
polluer la base locale. Les migrations sont appliquées automatiquement
(`migrationsRun`).

## Couverture actuelle

- **Unitaires** : validation de configuration, pagination/filtres/tri
  (listes blanches, échappement LIKE), enveloppe de réponse, filtre d'erreurs,
  contexte de requête, AuditService (filtrage des secrets), TokenService
  (JWT réels), LoginUseCase, RefreshTokensUseCase (rotation + réutilisation),
  RevokeSessionUseCase, LocalIdentityProvider, provider e-mail dev, stockage
  local (traversée de répertoires), générateur PDF (signature %PDF-), tâche de
  purge des sessions (concurrence, erreurs).
- **Intégration** : repositories users/sessions/audit contre SQL Server réel,
  contrainte d'unicité, soft delete, rotation/révocation/famille, purge,
  transactions (commit, rollback).
- **E2e** : cycle d'authentification complet (login valide/invalide, accès
  protégé, profil, sessions, refresh + rotation, refus d'un ancien token,
  révocation, logout, logout-all), formats standard (réponses, erreurs,
  validation DTO), santé, PDF de démonstration, upload/téléchargement/
  suppression de fichier, e-mail de démonstration.

## Écrire un nouveau test

- **Unitaires** : mocker les ports (interfaces) plutôt que les classes
  concrètes ; voir `refresh-tokens.use-case.spec.ts` pour le pattern
  « repository en mémoire ».
- **Intégration** : utiliser `createTestDataSource()`
  (`test/helpers/test-database.ts`), générer des identifiants uniques
  (`randomUUID`) pour rester indépendant de l'ordre d'exécution, et NETTOYER
  ses données en `afterAll`.
- **E2e** : `createE2eApplication()` applique exactement la même chaîne HTTP
  que la production ; `createE2eTestUser()` fournit un utilisateur jetable
  avec sa fonction de nettoyage ; `extractRefreshCookie()` facilite la
  manipulation du cookie.

Règles : aucune suite ne doit dépendre d'une autre ni de l'ordre d'exécution ;
chaque suite nettoie ce qu'elle crée.
