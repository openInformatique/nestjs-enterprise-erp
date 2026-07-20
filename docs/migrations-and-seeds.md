# Migrations et seeders

## Migrations

Toute évolution de schéma passe par une migration versionnée dans
`src/database/migrations/` (noms explicites : `CreateUsersTable`,
`AddIndexToAuditLogs`...). `synchronize` est définitivement désactivé.

### Commandes

```bash
# Générer une migration à partir du diff entités <-> schéma (recommandé)
npm run migration:generate -- src/database/migrations/NomExplicite

# Créer un squelette vide (SQL manuel : index filtrés, data migrations...)
npm run migration:create -- src/database/migrations/NomExplicite

npm run migration:run        # applique sur la base de l'environnement courant
npm run migration:run:test   # applique sur la base de test
npm run migration:show       # état : exécutées / en attente
npm run migration:revert     # annule la DERNIÈRE migration
```

### Bonnes pratiques

- TOUJOURS relire le SQL généré avant de l'exécuter ;
- une migration exécutée sur un environnement partagé ne se modifie plus : on
  en crée une nouvelle ;
- `down()` doit réellement annuler `up()` ;
- après un `migration:generate`, relancer la commande doit répondre « No
  changes » : c'est la preuve qu'entités et schéma sont alignés ;
- exécuter systématiquement les migrations sur la base de test
  (`migration:run:test`) — les suites d'intégration le font aussi
  automatiquement (`migrationsRun`).

## Seeders

`npm run seed` (ou `seed:test`) insère uniquement des données techniques :

- `admin@local.dev` (Administrateur local) et `user@local.dev` ;
- quelques audit logs de démonstration.

Caractéristiques :

- **idempotent** : les éléments existants sont ignorés ;
- **aucun mot de passe en dur** : `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`
  ou génération aléatoire affichée une seule fois en console ;
- hachage Argon2id, identique au chemin de production ;
- aucune session semée (fabriquer de fausses empreintes de refresh token
  n'aurait pas de valeur).

Pour ajouter un seed : compléter `src/database/seeds/run-seed.ts` en
respectant l'idempotence (vérifier l'existence avant d'insérer).
