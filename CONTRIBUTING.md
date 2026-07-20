# Contribuer au socle

## Prérequis

Suivre [docs/getting-started.md](docs/getting-started.md) pour disposer d'un
environnement fonctionnel (Node 24, Docker, bases initialisées).

## Conventions

### Langues

- **Anglais** : noms de fichiers, dossiers, classes, méthodes, variables,
  tables, colonnes, routes, codes d'erreur techniques.
- **Français** : commentaires, documentation, messages d'erreur renvoyés par
  l'API, descriptions Swagger.

### Code

- TypeScript strict ; `any` interdit sauf cas exceptionnel justifié par un
  commentaire ;
- les commentaires expliquent l'intention, les décisions et les contraintes —
  jamais la paraphrase d'une ligne de code ;
- contrôleurs légers : la logique vit dans les cas d'utilisation ;
- aucun accès direct à `process.env` hors de `src/config/` et des scripts CLI ;
- toute évolution de schéma passe par une migration (jamais `synchronize`) ;
- tri/filtres SQL uniquement via les listes blanches des helpers du socle ;
- aucune donnée sensible (mot de passe, jeton, cookie) dans les logs ou audits.

### Architecture

Respecter la direction des dépendances (voir
[docs/architecture.md](docs/architecture.md)) :

```text
presentation -> application -> domain
infrastructure -> application/domain
```

Pour un nouveau module : suivre [docs/create-a-module.md](docs/create-a-module.md).

## Avant de proposer une modification

```bash
npm run lint
npm run format:check
npm run build
npm run test:unit
npm run test:integration   # nécessite le conteneur SQL Server + .env.test
npm run test:e2e
```

Tout doit être au vert. Ajouter des tests pour tout nouveau comportement :
unitaires (logique), intégration (persistance), e2e (parcours HTTP).

## Git

- ne jamais commiter : secrets, fichiers `.env.*` (hors `*.example`), uploads,
  logs, couverture, builds ;
- messages de commit à l'impératif, concis, avec contexte si nécessaire ;
- pas de commit direct généré par un outil sans relecture.

## Documentation

Toute fonctionnalité nouvelle ou comportement modifié doit mettre à jour la
documentation concernée (`README.md`, `docs/*.md`) et, pour les choix
structurants, ajouter un ADR dans `docs/adr/`.
