# ADR 0001 — Architecture modulaire pragmatique (monolithe)

**Statut** : accepté — 2026-07-14

## Contexte

Le socle doit servir de base à plusieurs futures API d'entreprise. Les équipes
ont besoin d'une structure homogène, apprenable rapidement, qui sépare
clairement les responsabilités sans imposer un coût de cérémonie
disproportionné. La question du style d'architecture (monolithe vs
microservices, pureté Clean Architecture vs pragmatisme) devait être tranchée
avant toute ligne de code.

## Décision

1. **Monolithe modulaire** : un seul processus NestJS, découpé en modules
   autonomes (`users`, `authentication`, `audit`, briques techniques).
2. **Couches internes** `domain` / `application` / `infrastructure` /
   `presentation` appliquées **uniquement lorsque le module le justifie**
   (users, authentication, audit). Les modules purement techniques (health,
   mail, storage, pdf, scheduler) utilisent une structure plus légère.
3. **Direction des dépendances** : `presentation → application → domain` ;
   `infrastructure` implémente les contrats du domaine/application. Le domaine
   ne dépend d'aucun framework.
4. **Ports et adaptateurs pour les frontières externes** : identité
   (IdentityProviderPort), persistance (repositories), e-mail, stockage, PDF —
   ce qui permet de remplacer chaque brique sans toucher aux cas d'utilisation.
5. **Pas de préparation microservices** : pas de message broker, pas de
   découpage réseau, pas d'événements inter-services.

## Avantages

- démarrage et exploitation simples : un processus, une base, un déploiement ;
- transactions ACID naturelles (SQL Server local au processus) ;
- refactorings inter-modules triviaux comparés à des services distribués ;
- les ports rendent les évolutions lourdes (SSO, stockage cloud) locales ;
- courbe d'apprentissage raisonnable pour une équipe.

## Inconvénients assumés

- scalabilité uniquement verticale ou par réplication complète du monolithe
  (le scheduler devra alors recevoir un verrou distribué — documenté) ;
- pas d'isolation de panne entre modules ;
- la discipline de dépendances repose sur la revue de code (pas de frontière
  physique entre modules).

## Pourquoi pas les microservices ?

Aucun facteur déclencheur n'existe aujourd'hui : pas d'équipes multiples
autonomes, pas de besoins de scalabilité différenciée, pas de domaines aux
cycles de vie divergents. Les microservices ajouteraient immédiatement de la
complexité (réseau, cohérence, observabilité distribuée, déploiements) sans
bénéfice actuel. Si le besoin émerge, le découpage en modules aux frontières
nettes constituera le meilleur point de départ.

## Pourquoi une architecture « pragmatique » ?

L'objectif est la maîtrise des dépendances, pas la pureté doctrinale :
multiplier les couches et les fichiers pour des modules triviaux nuirait à la
lisibilité. La règle est donc : couches complètes quand il y a du domaine,
structure directe quand il n'y en a pas.
