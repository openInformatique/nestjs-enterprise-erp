# Architecture du socle

## Vue d'ensemble

Le socle `nestjs-enterprise-starter` est un **monolithe modulaire**. Il n'est pas préparé
pour les microservices : chaque brique technique est un module NestJS autonome au sein
d'un seul processus.

L'architecture s'inspire de manière **pragmatique** de la Clean Architecture et de
l'architecture hexagonale. L'objectif n'est pas de multiplier les fichiers, mais de
séparer les responsabilités et de maîtriser la direction des dépendances.

## Couches internes des modules

Lorsqu'un module le justifie (users, authentication, audit), il est découpé en quatre
couches :

```text
domain          Entités métier, objets de valeur, règles, interfaces de repositories.
                Ne dépend ni de NestJS, ni de TypeORM, ni d'Express.

application     Cas d'utilisation, commandes, requêtes, interfaces des services
                externes, orchestration. Ne dépend ni des contrôleurs ni de TypeORM.

infrastructure  Entités TypeORM, repositories concrets, accès SQL Server, adaptateurs
                (SMTP, stockage local...). Implémente les contrats du domaine et de
                la couche application.

presentation    Contrôleurs REST, DTO HTTP, décorateurs Swagger, guards et
                interceptors propres au module.
```

Les modules purement techniques (health, observability, mail, storage, pdf, scheduler)
utilisent une structure plus légère lorsque les quatre couches n'apportent rien.

## Direction des dépendances

```text
presentation -> application -> domain
infrastructure -> application / domain
```

Règles non négociables :

- le domaine ne dépend d'aucun framework ;
- les contrôleurs ne manipulent jamais directement un repository TypeORM ;
- les contrôleurs restent légers : ils délèguent aux cas d'utilisation ;
- l'infrastructure implémente les contrats définis par le domaine ou l'application,
  jamais l'inverse.

## Modules du socle

| Module           | Rôle                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `users`          | Utilisateurs techniques (authentification locale, futur lien SSO) |
| `authentication` | Login, JWT, sessions, rotation des refresh tokens, révocation     |
| `audit`          | Journal d'audit persistant (table `audit_logs`)                   |
| `observability`  | Métriques Prometheus                                              |
| `health`         | Endpoints de santé (live / ready)                                 |
| `mail`           | Envoi d'e-mails via un port avec adaptateurs dev et SMTP          |
| `storage`        | Stockage de fichiers via un port avec implémentation locale       |
| `pdf`            | Génération de PDF via un port                                     |
| `scheduler`      | Tâches planifiées (nettoyage des sessions expirées)               |

## Éléments transverses

- `src/common/` : composants réutilisables (pagination, filtres, enveloppe de réponse,
  exceptions, décorateurs, guards globaux...).
- `src/config/` : configuration typée et validée au démarrage.
- `src/database/` : DataSource TypeORM, migrations, seeds, helper de transaction.

Voir aussi l'ADR [0001 — Architecture modulaire pragmatique](adr/0001-modular-clean-architecture.md).
