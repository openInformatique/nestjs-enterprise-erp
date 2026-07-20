\# Création d’un socle back-end d’entreprise avec NestJS, TypeORM, SQL Server et Docker



\## 1. Ton rôle



Tu agis comme un architecte logiciel senior et un développeur back-end expert en :



\* NestJS ;

\* TypeScript ;

\* TypeORM ;

\* Microsoft SQL Server ;

\* sécurité des API REST ;

\* authentification JWT ;

\* architecture modulaire ;

\* Clean Architecture ;

\* architecture hexagonale ;

\* tests automatisés ;

\* Docker ;

\* documentation technique.



Tu disposes d’un dossier de travail vide, d’un terminal et de la possibilité de créer ou modifier les fichiers du projet.



Tu dois construire intégralement un socle back-end NestJS robuste, réutilisable, documenté et prêt à servir de base aux futures applications de l’entreprise.



Le projet doit être réalisé directement dans le workspace actuel.



\---



\# 2. Objectif général



Créer un socle technique back-end nommé :



```text

nestjs-enterprise-starter

```



Ce socle devra permettre de démarrer rapidement une nouvelle API d’entreprise à partir d’une base :



\* robuste ;

\* modulaire ;

\* maintenable ;

\* sécurisée ;

\* testable ;

\* documentée ;

\* facilement extensible ;

\* homogène entre les différents projets.



Le socle est strictement technique.



Il ne doit contenir aucune fonctionnalité de mini-ERP, aucune gestion de clients, de fournisseurs, de produits, de commandes ou de factures.



Les seuls domaines fonctionnels présents doivent servir au fonctionnement et à la démonstration du socle :



\* utilisateurs techniques ;

\* authentification ;

\* sessions ;

\* journal d’audit ;

\* observabilité ;

\* stockage de fichiers ;

\* envoi d’e-mails ;

\* génération de PDF ;

\* tâches planifiées.



\---



\# 3. Méthode de travail obligatoire



Tu dois travailler étape par étape, dans l’ordre indiqué dans ce document.



Tu ne dois pas générer une architecture partielle ou une simple démonstration théorique.



Tu dois réellement :



\* créer les fichiers ;

\* installer les dépendances ;

\* écrire le code ;

\* créer les migrations ;

\* créer les tests ;

\* exécuter les commandes ;

\* corriger les erreurs ;

\* compiler le projet ;

\* exécuter les tests ;

\* rédiger la documentation.



À la fin de chaque étape :



1\. vérifie que le code compile ;

2\. exécute les tests concernés lorsqu’ils existent ;

3\. corrige immédiatement les erreurs rencontrées ;

4\. mets à jour le fichier `IMPLEMENTATION\_PROGRESS.md` ;

5\. indique brièvement les fichiers créés ou modifiés ;

6\. poursuis avec l’étape suivante.



Ne poursuis jamais sur une base qui ne compile plus.



Ne masque jamais une erreur avec un contournement temporaire non documenté.



Lorsqu’un choix technique mineur n’est pas explicitement défini dans ce document, sélectionne la solution :



\* la plus standard dans l’écosystème NestJS ;

\* la plus lisible ;

\* la plus maintenable ;

\* la moins magique ;

\* la plus simple à remplacer ultérieurement.



Ne demande une précision que lorsqu’un blocage empêche réellement de continuer. Tous les choix structurants nécessaires sont déjà définis dans ce document.



\---



\# 4. Suivi de l’implémentation



Commence par créer le fichier :



```text

IMPLEMENTATION\_PROGRESS.md

```



Ce fichier doit contenir toutes les étapes du projet sous forme de cases à cocher.



Exemple :



```markdown

\# Progression de l’implémentation



\- \[ ] Initialisation du projet

\- \[ ] Configuration TypeScript

\- \[ ] Configuration des environnements

\- \[ ] Docker SQL Server

\- \[ ] Connexion TypeORM

\- \[ ] Migrations

\- \[ ] Gestion globale des erreurs

\- \[ ] Authentification

\- \[ ] Tests

\- \[ ] Documentation

```



Mets ce fichier à jour après chaque étape terminée.



Ajoute également une courte section indiquant :



\* les décisions techniques prises ;

\* les éventuels écarts par rapport au plan ;

\* les points restant à réaliser ;

\* les commandes de validation déjà exécutées.



\---



\# 5. Technologies et versions



Utilise les technologies suivantes :



\* Node.js 24 LTS ;

\* npm ;

\* NestJS 11 ;

\* TypeScript en mode strict ;

\* Express comme adaptateur HTTP NestJS ;

\* TypeORM dans une version stable compatible avec NestJS et SQL Server ;

\* Microsoft SQL Server 2022 ;

\* Jest pour les tests ;

\* Supertest pour les tests end-to-end ;

\* Swagger/OpenAPI ;

\* Pino pour les logs.



N’utilise aucune version bêta, release candidate ou expérimentale.



Avant l’installation, vérifie la compatibilité des versions sélectionnées.



Le fichier `package-lock.json` doit être généré et conservé.



Le projet doit être déclaré privé dans le `package.json` :



```json

{

&#x20; "private": true

}

```



\---



\# 6. Langues et conventions



Les éléments suivants doivent être écrits en anglais :



\* noms des fichiers ;

\* noms des dossiers ;

\* noms des classes ;

\* noms des interfaces ;

\* noms des méthodes ;

\* noms des variables ;

\* noms des tables ;

\* noms des colonnes ;

\* noms des routes ;

\* codes d’erreur techniques.



Les éléments suivants doivent être écrits en français :



\* commentaires du code ;

\* documentation ;

\* README ;

\* guides ;

\* messages d’erreur retournés aux consommateurs de l’API ;

\* descriptions Swagger, lorsque cela reste pertinent.



Exemple :



```typescript

/\*\*

&#x20;\* Vérifie qu’une session d’authentification est encore valide.

&#x20;\*

&#x20;\* Une session révoquée ne peut plus être utilisée pour renouveler

&#x20;\* un jeton d’accès, même si le refresh token n’a pas encore expiré.

&#x20;\*/

async validateSession(sessionId: string): Promise<AuthSession> {

&#x20; // ...

}

```



Le code doit être très commenté, mais les commentaires doivent expliquer :



\* l’intention ;

\* les décisions d’architecture ;

\* les raisons d’un choix ;

\* les contraintes de sécurité ;

\* les points d’extension ;

\* les comportements non évidents.



Évite les commentaires inutiles qui reformulent littéralement une ligne de code.



\---



\# 7. Contraintes d’architecture



\## 7.1 Type d’architecture



Construis un monolithe modulaire.



Ne prépare pas le projet pour les microservices.



Utilise une architecture pragmatique inspirée :



\* de la Clean Architecture ;

\* de l’architecture hexagonale ;

\* du Domain-Driven Design uniquement lorsque cela apporte une réelle valeur.



L’objectif n’est pas de multiplier artificiellement les fichiers.



L’objectif est de séparer clairement les responsabilités et de maîtriser les dépendances.



\## 7.2 Couches internes des modules



Lorsque le module le justifie, utilise les couches suivantes :



```text

domain

application

infrastructure

presentation

```



Le rôle de chaque couche est le suivant.



\### Domain



Contient :



\* les entités métier indépendantes ;

\* les objets de valeur éventuels ;

\* les règles métier ;

\* les interfaces de repositories ;

\* les contrats nécessaires au domaine.



Le domaine ne doit dépendre ni de NestJS, ni de TypeORM, ni d’Express.



\### Application



Contient :



\* les cas d’utilisation ;

\* les commandes ;

\* les requêtes ;

\* les interfaces des services externes ;

\* l’orchestration des règles ;

\* les modèles d’entrée et de sortie internes.



Les cas d’utilisation ne doivent pas dépendre directement des contrôleurs ou de TypeORM.



\### Infrastructure



Contient :



\* les entités TypeORM ;

\* les repositories TypeORM ;

\* les accès SQL Server ;

\* les adaptateurs SMTP ;

\* le stockage local ;

\* les implémentations des services techniques ;

\* les fournisseurs externes.



\### Presentation



Contient :



\* les contrôleurs REST ;

\* les DTO HTTP ;

\* les décorateurs Swagger ;

\* les guards ;

\* les interceptors propres au module ;

\* les éléments liés au protocole HTTP.



\## 7.3 Direction des dépendances



Respecte autant que possible la direction suivante :



```text

presentation -> application -> domain

infrastructure -> application/domain

```



L’infrastructure doit implémenter les contrats définis dans le domaine ou dans la couche application.



Les contrôleurs ne doivent jamais manipuler directement un repository TypeORM.



Les contrôleurs doivent rester très légers.



\---



\# 8. Structure cible du projet



Utilise une structure proche de celle-ci, en l’adaptant uniquement lorsqu’une amélioration est réellement justifiée :



```text

src/

├── main.ts

├── app.module.ts

│

├── common/

│   ├── constants/

│   ├── decorators/

│   ├── dto/

│   ├── enums/

│   ├── exceptions/

│   ├── filters/

│   ├── guards/

│   ├── interceptors/

│   ├── interfaces/

│   ├── mappers/

│   ├── pagination/

│   ├── pipes/

│   ├── types/

│   └── utils/

│

├── config/

│   ├── configuration.module.ts

│   ├── environment.validation.ts

│   ├── app.config.ts

│   ├── auth.config.ts

│   ├── database.config.ts

│   ├── logging.config.ts

│   ├── mail.config.ts

│   ├── storage.config.ts

│   └── swagger.config.ts

│

├── database/

│   ├── database.module.ts

│   ├── database.constants.ts

│   ├── data-source.ts

│   ├── migrations/

│   ├── seeds/

│   ├── scripts/

│   └── transaction/

│

├── modules/

│   ├── users/

│   │   ├── domain/

│   │   ├── application/

│   │   ├── infrastructure/

│   │   ├── presentation/

│   │   └── users.module.ts

│   │

│   ├── authentication/

│   │   ├── domain/

│   │   ├── application/

│   │   ├── infrastructure/

│   │   ├── presentation/

│   │   └── authentication.module.ts

│   │

│   ├── audit/

│   │   ├── domain/

│   │   ├── application/

│   │   ├── infrastructure/

│   │   ├── presentation/

│   │   └── audit.module.ts

│   │

│   ├── observability/

│   ├── health/

│   ├── mail/

│   ├── storage/

│   ├── pdf/

│   └── scheduler/

│

└── documentation/

```



Les tests unitaires peuvent être placés à proximité des fichiers testés.



Les tests d’intégration et end-to-end doivent être placés dans des dossiers clairement séparés :



```text

test/

├── integration/

├── e2e/

├── fixtures/

├── factories/

└── helpers/

```



\---



\# 9. Qualité du code



Active le mode strict de TypeScript.



Évite totalement `any`, sauf cas exceptionnel clairement justifié par un commentaire.



Active notamment les contrôles TypeScript pertinents :



```json

{

&#x20; "strict": true,

&#x20; "noImplicitAny": true,

&#x20; "strictNullChecks": true,

&#x20; "noUncheckedIndexedAccess": true,

&#x20; "noImplicitOverride": true,

&#x20; "forceConsistentCasingInFileNames": true

}

```



Configure :



\* ESLint ;

\* Prettier ;

\* EditorConfig.



N’intègre pas :



\* Husky ;

\* lint-staged ;

\* commitlint ;

\* SonarQube ;

\* seuil obligatoire de couverture ;

\* pipeline CI/CD.



Ajoute des scripts npm pour :



```text

lint

lint:fix

format

format:check

build

start

start:dev

start:debug

test

test:unit

test:integration

test:e2e

test:cov

```



\---



\# 10. Configuration des environnements



Prépare uniquement les environnements :



\* local ;

\* development ;

\* test.



Le projet doit charger une configuration typée.



N’utilise ni Joi ni Zod.



Utilise `class-validator` et `class-transformer` pour vérifier les variables d’environnement au démarrage.



L’application doit refuser de démarrer lorsqu’une variable obligatoire est absente ou invalide.



Le message d’erreur de configuration doit être explicite.



Prépare notamment les fichiers suivants :



```text

.env.example

.env.local.example

.env.development.example

.env.test.example

```



Aucun secret réel ne doit être commité.



La configuration doit au minimum couvrir :



```text

NODE\_ENV

APP\_NAME

APP\_HOST

APP\_PORT

APP\_GLOBAL\_PREFIX

APP\_VERSION

APP\_CORS\_ORIGINS



DB\_HOST

DB\_PORT

DB\_USERNAME

DB\_PASSWORD

DB\_DATABASE

DB\_TEST\_DATABASE

DB\_ENCRYPT

DB\_TRUST\_SERVER\_CERTIFICATE



JWT\_ACCESS\_SECRET

JWT\_ACCESS\_EXPIRATION

JWT\_REFRESH\_SECRET

JWT\_REFRESH\_EXPIRATION



REFRESH\_COOKIE\_NAME

REFRESH\_COOKIE\_SECURE

REFRESH\_COOKIE\_SAME\_SITE

REFRESH\_COOKIE\_DOMAIN



LOG\_LEVEL

SWAGGER\_ENABLED

METRICS\_ENABLED

SCHEDULER\_ENABLED

TECHNICAL\_DEMO\_ENDPOINTS\_ENABLED



MAIL\_DRIVER

MAIL\_HOST

MAIL\_PORT

MAIL\_USERNAME

MAIL\_PASSWORD

MAIL\_FROM



STORAGE\_DRIVER

STORAGE\_LOCAL\_PATH

STORAGE\_MAX\_FILE\_SIZE

STORAGE\_ALLOWED\_MIME\_TYPES

```



Centralise l’accès aux paramètres.



Évite les appels dispersés à `process.env` dans l’application.



\---



\# 11. Docker et SQL Server



\## 11.1 Règle principale



Le conteneur Docker doit englober uniquement Microsoft SQL Server.



NestJS doit être exécuté localement sur la machine du développeur.



Le fichier `docker-compose.yml` ne doit donc pas démarrer l’application NestJS.



\## 11.2 Docker Compose



Crée un fichier :



```text

docker-compose.yml

```



Il doit démarrer une image officielle de Microsoft SQL Server 2022 avec :



\* acceptation de la licence ;

\* mot de passe administrateur provenant de l’environnement ;

\* port configurable ;

\* volume persistant ;

\* nom de conteneur explicite ;

\* health check ;

\* redémarrage contrôlé ;

\* réseau Docker clairement nommé.



Les données doivent être conservées après un redémarrage du conteneur.



Ajoute des scripts npm :



```text

docker:db:up

docker:db:down

docker:db:restart

docker:db:logs

docker:db:status

```



\## 11.3 Initialisation des bases



Prépare un script permettant de créer automatiquement, si elles n’existent pas :



```text

nestjs\_starter\_local

nestjs\_starter\_test

```



Ces deux bases utilisent la même instance SQL Server.



La base `nestjs\_starter\_test` doit uniquement servir aux tests d’intégration et end-to-end.



Le script doit être idempotent.



Ajoute une commande proche de :



```text

npm run db:init

```



\## 11.4 Dockerfile de développement



Crée également un fichier :



```text

Dockerfile.dev

```



Il sert de référence ou à une éventuelle utilisation future, mais il ne doit pas être utilisé par le `docker-compose.yml` local.



Documente clairement cette distinction.



\## 11.5 SQL Server Management Studio



Le README doit expliquer comment se connecter à la base depuis SQL Server Management Studio avec :



\* le serveur ;

\* le port ;

\* l’utilisateur ;

\* le mode d’authentification ;

\* les options de chiffrement ;

\* l’option de confiance du certificat local.



\---



\# 12. TypeORM et migrations



Utilise TypeORM avec le pilote SQL Server approprié.



La propriété suivante doit toujours être désactivée :



```typescript

synchronize: false

```



Toutes les évolutions de schéma doivent passer par des migrations.



Prépare des scripts npm pour :



```text

migration:create

migration:generate

migration:run

migration:revert

migration:show

migration:run:test

```



Les commandes doivent fonctionner avec la configuration TypeScript du projet.



Les migrations doivent être stockées dans :



```text

src/database/migrations

```



Les noms des migrations doivent être explicites.



Exemple :



```text

CreateUsersTable

CreateAuthSessionsTable

CreateAuditLogsTable

```



Prépare également :



\* un système léger de seeders ;

\* un script de nettoyage de la base de test ;

\* un helper de transaction basé sur `DataSource.transaction`.



Ne crée pas de repository générique universel masquant complètement TypeORM.



Les modules doivent pouvoir écrire des requêtes spécifiques avec `QueryBuilder` lorsque cela est nécessaire.



\---



\# 13. Tables techniques à créer



Crée trois tables applicatives principales.



TypeORM peut également créer sa table technique de suivi des migrations.



\## 13.1 Table `users`



Cette table représente les utilisateurs techniques pouvant s’authentifier localement ou être associés plus tard à une identité SSO.



Prévois au minimum :



```text

id

email

display\_name

password\_hash

authentication\_source

is\_active

last\_login\_at

created\_at

updated\_at

deleted\_at

created\_by

updated\_by

```



Contraintes :



\* `id` utilise un UUID SQL Server de type `uniqueidentifier` ;

\* `email` est obligatoire ;

\* `email` est unique ;

\* l’e-mail est normalisé en minuscules ;

\* `password\_hash` est nullable afin d’autoriser de futurs utilisateurs SSO ;

\* aucun mot de passe n’est stocké en clair ;

\* les dates utilisent un type SQL Server précis, de préférence `datetime2` ;

\* la suppression logique doit être supportée.



Crée un enum pour la source d’authentification, par exemple :



```text

LOCAL

SSO

```



Ne crée pas encore de tables pour les rôles ou les permissions.



\## 13.2 Table `auth\_sessions`



Cette table gère les sessions et les refresh tokens.



Prévois au minimum :



```text

id

user\_id

refresh\_token\_hash

token\_family\_id

user\_agent

ip\_address

last\_used\_at

expires\_at

revoked\_at

revocation\_reason

created\_at

updated\_at

```



Contraintes :



\* `id` utilise un UUID ;

\* `user\_id` référence `users` ;

\* le refresh token ne doit jamais être enregistré en clair ;

\* la session peut être révoquée ;

\* la date d’expiration doit être vérifiée ;

\* la rotation des refresh tokens doit être prise en charge ;

\* la réutilisation d’un ancien refresh token doit pouvoir être détectée ;

\* une session compromise doit pouvoir entraîner la révocation de toute sa famille de tokens.



Ajoute les index pertinents pour :



\* `user\_id` ;

\* `token\_family\_id` ;

\* `expires\_at` ;

\* `revoked\_at`.



\## 13.3 Table `audit\_logs`



Cette table stocke les événements d’audit persistants.



Prévois au minimum :



```text

id

category

action

actor\_user\_id

resource\_type

resource\_id

request\_id

ip\_address

user\_agent

metadata

created\_at

```



Contraintes :



\* un audit log est immuable ;

\* aucun endpoint de suppression ou de modification ne doit être créé ;

\* `actor\_user\_id` peut être nullable ;

\* `metadata` doit permettre de stocker une structure JSON dans un `nvarchar(max)` ;

\* les données sensibles doivent être filtrées avant leur stockage ;

\* aucun mot de passe, JWT, cookie ou refresh token ne doit être enregistré.



Les catégories doivent permettre de distinguer :



```text

TECHNICAL

BUSINESS

SECURITY

AUDIT

```



Même si toutes les catégories ne sont pas encore utilisées fonctionnellement, l’architecture doit les prévoir.



\---



\# 14. Entités techniques communes



Crée une classe abstraite adaptée aux entités modifiables contenant :



```text

id

createdAt

updatedAt

deletedAt

createdBy

updatedBy

```



Les champs `createdBy` et `updatedBy` doivent être facultatifs.



Évite d’imposer une relation TypeORM directe vers `users` à toutes les entités.



Les identifiants de créateur et de modificateur peuvent être stockés sous forme d’UUID nullable.



Les entités immuables, comme les audit logs, peuvent utiliser une base plus légère et adaptée.



Toutes les dates applicatives doivent être interprétées et renvoyées en UTC.



\---



\# 15. Seeders



Crée un seeder léger.



Il doit insérer uniquement quelques données techniques :



\* deux utilisateurs locaux ;

\* quelques sessions de démonstration si cela est utile ;

\* quelques audit logs de démonstration.



Crée notamment un utilisateur administrateur local de développement.



Le mot de passe du seeder ne doit pas être codé en dur dans le dépôt.



Il doit être fourni par une variable d’environnement dédiée ou généré de manière contrôlée et clairement affiché uniquement dans l’environnement local.



Le seeder doit être idempotent.



Ajoute les commandes :



```text

npm run seed

npm run seed:test

```



\---



\# 16. API REST et versionnement



L’application expose uniquement une API REST.



Configure le versionnement par URI.



Les routes doivent suivre cette structure :



```text

/api/v1/...

```



Configure proprement :



\* le préfixe global `/api` ;

\* la version `v1` ;

\* la possibilité de modifier le préfixe par configuration.



Les routes techniques suivantes sont attendues :



```text

POST   /api/v1/auth/login

POST   /api/v1/auth/refresh

POST   /api/v1/auth/logout

POST   /api/v1/auth/logout-all

GET    /api/v1/auth/sessions

DELETE /api/v1/auth/sessions/:id

GET    /api/v1/auth/me

```



Ajoute également les endpoints de santé et d’observabilité définis plus bas.



\---



\# 17. Enveloppe standardisée des réponses



Crée un interceptor global chargé d’uniformiser les réponses JSON.



\## 17.1 Réponse réussie simple



Format attendu :



```json

{

&#x20; "success": true,

&#x20; "data": {

&#x20;   "id": "uuid"

&#x20; },

&#x20; "meta": {

&#x20;   "requestId": "uuid",

&#x20;   "timestamp": "2026-07-14T08:30:00.000Z"

&#x20; }

}

```



\## 17.2 Réponse paginée



Format attendu :



```json

{

&#x20; "success": true,

&#x20; "data": \[],

&#x20; "meta": {

&#x20;   "requestId": "uuid",

&#x20;   "timestamp": "2026-07-14T08:30:00.000Z",

&#x20;   "pagination": {

&#x20;     "page": 1,

&#x20;     "limit": 20,

&#x20;     "totalItems": 48,

&#x20;     "totalPages": 3,

&#x20;     "hasNextPage": true,

&#x20;     "hasPreviousPage": false

&#x20;   }

&#x20; }

}

```



\## 17.3 Cas à exclure de l’enveloppe



L’interceptor ne doit pas casser :



\* les réponses binaires ;

\* les téléchargements de fichiers ;

\* les flux ;

\* les réponses HTTP 204 ;

\* Swagger ;

\* l’endpoint Prometheus ;

\* les endpoints qui demandent explicitement une réponse brute.



Crée un décorateur explicite permettant de désactiver l’enveloppe sur un endpoint.



\---



\# 18. Pagination, filtres, recherche et tri



Crée des composants communs réutilisables pour :



\* la pagination ;

\* le tri ;

\* les filtres ;

\* la recherche textuelle.



Prévois notamment :



```text

PaginationQueryDto

PaginationMetaDto

PaginatedResult<T>

SortDirection

FilterOperator

TypeOrmPaginationHelper

TypeOrmFilterHelper

```



Règles :



\* page par défaut : `1` ;

\* limite par défaut : `20` ;

\* limite maximale : `100` ;

\* validation stricte des valeurs ;

\* tri uniquement sur une liste blanche de colonnes autorisées ;

\* filtres uniquement sur une liste blanche ;

\* aucun nom de colonne brut provenant directement de l’utilisateur dans une requête SQL ;

\* utilisation de paramètres TypeORM pour éviter les injections SQL.



Les helpers doivent faciliter les requêtes sans transformer TypeORM en abstraction opaque.



Ajoute des tests unitaires complets sur ces composants.



Ajoute un exemple documenté montrant comment un futur module pourra utiliser ces helpers.



\---



\# 19. Validation globale des entrées



Configure un `ValidationPipe` global avec au minimum :



```typescript

{

&#x20; whitelist: true,

&#x20; forbidNonWhitelisted: true,

&#x20; transform: true

}

```



Ajoute les options complémentaires pertinentes.



Tous les DTO doivent utiliser `class-validator`.



Les transformations doivent utiliser `class-transformer`.



Les erreurs de validation doivent être converties dans le format d’erreur standardisé défini plus bas.



Les paramètres de routes, query strings et corps de requêtes doivent tous être validés.



\---



\# 20. Gestion globale des erreurs



Crée une hiérarchie claire d’exceptions applicatives.



Prévois notamment des codes techniques stables :



```text

VALIDATION\_ERROR

AUTHENTICATION\_FAILED

ACCESS\_TOKEN\_INVALID

REFRESH\_TOKEN\_INVALID

SESSION\_EXPIRED

SESSION\_REVOKED

REFRESH\_TOKEN\_REUSE\_DETECTED

RESOURCE\_NOT\_FOUND

RESOURCE\_ALREADY\_EXISTS

DATABASE\_ERROR

FILE\_NOT\_FOUND

FILE\_TYPE\_NOT\_ALLOWED

FILE\_TOO\_LARGE

INTERNAL\_SERVER\_ERROR

```



Les messages retournés par l’API doivent être en français.



Format attendu :



```json

{

&#x20; "success": false,

&#x20; "error": {

&#x20;   "code": "VALIDATION\_ERROR",

&#x20;   "message": "Les données transmises sont invalides.",

&#x20;   "details": \[

&#x20;     {

&#x20;       "field": "email",

&#x20;       "message": "L’adresse e-mail n’est pas valide."

&#x20;     }

&#x20;   ]

&#x20; },

&#x20; "meta": {

&#x20;   "requestId": "uuid",

&#x20;   "timestamp": "2026-07-14T08:30:00.000Z",

&#x20;   "path": "/api/v1/auth/login"

&#x20; }

}

```



Crée un filtre global d’exceptions.



Il doit :



\* convertir les exceptions connues ;

\* convertir les erreurs TypeORM pertinentes ;

\* éviter de divulguer les détails SQL ;

\* ne jamais exposer une stack trace en dehors du mode local ;

\* journaliser l’erreur avec le request ID ;

\* conserver les informations utiles au diagnostic dans les logs ;

\* renvoyer un message générique en cas d’erreur inconnue.



\---



\# 21. Sécurité HTTP



Intègre et configure :



\* Helmet ;

\* CORS avec liste blanche configurable ;

\* limitation de requêtes ;

\* désactivation de l’en-tête exposant Express ;

\* limitation de la taille des corps HTTP ;

\* validation stricte des entrées ;

\* protection des endpoints techniques ;

\* politique adaptée pour les cookies ;

\* redaction des secrets dans les logs.



Le CORS ne doit jamais utiliser une origine totalement ouverte lorsque les credentials sont activés.



La liste des origines doit provenir de la configuration.



Ajoute un mécanisme de rate limiting raisonnable, configurable par environnement.



Applique des règles plus restrictives sur :



```text

POST /auth/login

POST /auth/refresh

```



Documente les choix effectués.



\---



\# 22. Authentification locale



Implémente une authentification locale de démonstration.



Elle servira de fournisseur d’identité initial tant que le système SSO définitif n’est pas choisi.



Utilise un algorithme robuste de hachage de mot de passe, de préférence Argon2id.



Ne stocke et ne journalise jamais :



\* le mot de passe ;

\* le hash du mot de passe ;

\* l’access token ;

\* le refresh token ;

\* le hash du refresh token ;

\* le contenu des cookies d’authentification.



Le login doit :



1\. normaliser l’e-mail ;

2\. rechercher l’utilisateur ;

3\. vérifier que l’utilisateur existe ;

4\. vérifier qu’il est actif ;

5\. comparer le mot de passe ;

6\. créer une session ;

7\. générer un access token ;

8\. générérer un refresh token ;

9\. stocker uniquement l’empreinte du refresh token ;

10\. enregistrer un audit de sécurité ;

11\. mettre à jour `last\_login\_at`.



Le message renvoyé en cas d’identifiant ou de mot de passe incorrect doit rester volontairement générique.



\---



\# 23. JWT, access token et refresh token



\## 23.1 Access token



L’access token doit :



\* être un JWT ;

\* avoir une durée courte ;

\* être renvoyé dans le corps de la réponse ;

\* être utilisé avec l’en-tête `Authorization: Bearer`;

\* contenir au minimum `sub`, `sid`, `jti`, `iat` et `exp` ;

\* contenir uniquement les informations strictement nécessaires.



\## 23.2 Refresh token



Le refresh token doit :



\* être distinct de l’access token ;

\* avoir une durée plus longue ;

\* être transmis dans un cookie `HttpOnly` ;

\* être `Secure` selon l’environnement ;

\* avoir une politique `SameSite` configurable ;

\* être limité à un chemin cohérent ;

\* ne jamais être accessible au JavaScript du front ;

\* ne jamais être stocké en clair en base.



\## 23.3 Rotation



À chaque rafraîchissement :



1\. vérifie la signature du refresh token ;

2\. retrouve la session ;

3\. vérifie l’expiration ;

4\. vérifie la révocation ;

5\. compare le token reçu avec son empreinte stockée ;

6\. génère un nouveau refresh token ;

7\. remplace l’empreinte stockée ;

8\. met à jour `last\_used\_at` ;

9\. renvoie un nouvel access token ;

10\. remplace le cookie.



\## 23.4 Détection de réutilisation



Si un ancien refresh token valide cryptographiquement est réutilisé après rotation :



\* considère la session comme potentiellement compromise ;

\* révoque la famille de tokens concernée ;

\* enregistre un audit de sécurité ;

\* refuse la demande avec le code `REFRESH\_TOKEN\_REUSE\_DETECTED`.



Documente précisément ce comportement.



\## 23.5 Révocation



Implémente :



\* la déconnexion de la session actuelle ;

\* la révocation d’une session précise ;

\* la révocation de toutes les sessions d’un utilisateur ;

\* l’affichage des sessions actives de l’utilisateur connecté.



Un utilisateur ne doit pouvoir gérer que ses propres sessions dans cette version du socle.



Lorsqu’une session est révoquée, son refresh token ne doit plus pouvoir être utilisé.



Documente le fait qu’un access token déjà émis reste normalement valide jusqu’à sa courte expiration, sauf ajout ultérieur d’une vérification systématique de session.



\---



\# 24. Préparation du SSO



Le fournisseur SSO définitif n’est pas encore choisi.



Il peut s’agir ultérieurement :



\* de Microsoft Entra ID ;

\* d’OpenID Connect ;

\* d’un Active Directory local ;

\* de Kerberos ;

\* d’une authentification Windows intégrée ;

\* d’un autre fournisseur d’identité.



Ne simule pas un faux SSO.



Crée une abstraction claire, par exemple :



```typescript

export interface IdentityProviderPort {

&#x20; authenticate(input: AuthenticationInput): Promise<AuthenticatedIdentity>;

}

```



Prévois :



\* un fournisseur local fonctionnel ;

\* les types nécessaires à une identité externe ;

\* un système d’injection permettant de remplacer ou compléter le fournisseur local ;

\* une documentation expliquant comment ajouter un fournisseur SSO ;

\* un point de liaison entre une identité externe et un utilisateur interne.



Ne crée pas encore d’implémentation Entra ID, Kerberos ou OpenID Connect.



Ne crée pas de code factice prétendant authentifier un utilisateur SSO.



\---



\# 25. Préparation des rôles et permissions



Le modèle définitif des rôles et permissions n’est pas encore choisi.



Ne crée aucune table de rôle ou de permission.



Prépare néanmoins l’architecture avec des contrats neutres.



Exemple :



```typescript

export interface AuthorizationPort {

&#x20; isAllowed(

&#x20;   user: AuthenticatedUser,

&#x20;   requirement: AuthorizationRequirement,

&#x20; ): Promise<boolean>;

}

```



Prévois éventuellement :



\* un type `Permission`;

\* un type `AuthorizationRequirement`;

\* un décorateur de métadonnées ;

\* un futur point d’intégration avec un guard.



Ne crée pas de faux système d’autorisation permissif activé globalement.



L’application doit uniquement imposer l’authentification sur les endpoints protégés pour le moment.



Documente comment ajouter plus tard :



\* RBAC ;

\* permissions unitaires ;

\* rôles regroupant des permissions ;

\* règles contextuelles.



\---



\# 26. Utilisateur courant



Crée un décorateur permettant d’obtenir l’utilisateur authentifié :



```typescript

@CurrentUser()

```



Crée un type strict représentant les informations disponibles dans le contexte HTTP.



Évite d’exposer directement l’entité TypeORM dans les contrôleurs.



Ajoute également un décorateur :



```typescript

@Public()

```



Le guard JWT global doit ignorer uniquement les routes explicitement déclarées publiques.



\---



\# 27. Logs avec Pino



Utilise Pino, idéalement par l’intégration NestJS appropriée.



Les logs doivent être structurés en JSON.



Prévois :



\* un format lisible en environnement local ;

\* un format JSON brut en environnement de développement partagé ;

\* un niveau configurable ;

\* un request ID ;

\* la méthode HTTP ;

\* la route ;

\* le statut ;

\* la durée ;

\* l’adresse IP ;

\* le user-agent ;

\* l’identifiant utilisateur lorsque disponible ;

\* l’identifiant de session lorsque pertinent.



Ajoute une redaction stricte pour :



```text

authorization

cookie

set-cookie

password

passwordHash

accessToken

refreshToken

refreshTokenHash

JWT secrets

mail password

database password

```



Les logs doivent pouvoir être collectés ultérieurement sans modifier le cœur de l’application par :



\* Grafana Loki ;

\* Elasticsearch/Kibana ;

\* un collecteur compatible avec les logs JSON de Docker ou du système.



N’intègre pas directement une stack Grafana, Loki, Elasticsearch ou Kibana dans Docker.



Documente simplement les possibilités d’intégration.



\---



\# 28. Request ID et contexte de requête



Chaque requête doit disposer d’un identifiant unique.



Comportement attendu :



\* réutiliser `x-request-id` lorsqu’il est valide ;

\* sinon générer un UUID ;

\* ajouter cet identifiant dans les logs ;

\* ajouter cet identifiant dans les réponses ;

\* renvoyer l’identifiant dans l’en-tête de réponse ;

\* le rendre disponible aux services d’audit.



Crée un contexte de requête basé sur `AsyncLocalStorage` ou une abstraction stable équivalente.



Ce contexte doit pouvoir contenir :



```text

requestId

userId

sessionId

ipAddress

userAgent

startedAt

```



Documente l’utilisation de ce contexte.



\---



\# 29. Journal d’audit



Les logs techniques et les audits ne doivent pas être confondus.



Les logs Pino servent au diagnostic technique.



La table `audit\_logs` sert à conserver les événements importants.



Crée un `AuditService` réutilisable.



Il doit permettre d’enregistrer notamment :



\* connexion réussie ;

\* connexion refusée ;

\* renouvellement de token ;

\* déconnexion ;

\* révocation de session ;

\* détection de réutilisation d’un refresh token ;

\* génération d’un PDF de démonstration ;

\* envoi d’un e-mail de démonstration ;

\* dépôt ou suppression d’un fichier ;

\* erreur de sécurité significative.



Ajoute un décorateur ou un mécanisme permettant à un futur cas d’utilisation de déclarer facilement un audit.



Ne cherche pas à enregistrer automatiquement toutes les modifications SQL de manière aveugle.



Privilégie un audit explicite depuis les cas d’utilisation, avec un contexte riche et maîtrisé.



Filtre les valeurs sensibles avant insertion.



\---



\# 30. Santé de l’application



Utilise le module NestJS adapté pour créer des endpoints de santé.



Crée au minimum :



```text

GET /api/v1/health

GET /api/v1/health/live

GET /api/v1/health/ready

```



Comportement attendu :



\* `live` vérifie que le processus répond ;

\* `ready` vérifie notamment la connexion SQL Server ;

\* `health` renvoie une synthèse adaptée.



Les endpoints de santé doivent être publics.



Ils ne doivent pas exposer :



\* les mots de passe ;

\* les chaînes de connexion ;

\* les secrets ;

\* les détails internes inutiles.



\---



\# 31. Métriques Prometheus



Ajoute une intégration légère de métriques Prometheus.



Crée un endpoint configurable :



```text

GET /metrics

```



Cet endpoint ne doit pas utiliser l’enveloppe JSON standard.



Prévois au minimum :



\* métriques du processus Node.js ;

\* nombre de requêtes HTTP ;

\* durée des requêtes ;

\* statut HTTP ;

\* méthode ;

\* route normalisée.



Évite les labels à cardinalité élevée.



Ne mets jamais dans un label :



\* user ID ;

\* session ID ;

\* request ID ;

\* URL complète avec identifiant ;

\* adresse IP.



L’endpoint doit pouvoir être désactivé par configuration.



Documente qu’en production il devra être protégé par le réseau, un proxy ou une authentification adaptée.



\---



\# 32. Swagger et OpenAPI



Swagger est une fonctionnalité essentielle du socle.



Configure :



```text

/api/docs

/api/docs-json

```



Swagger doit pouvoir être désactivé par configuration.



Documente :



\* tous les endpoints ;

\* les DTO ;

\* les paramètres ;

\* les réponses réussies ;

\* les erreurs possibles ;

\* l’authentification Bearer ;

\* le refresh token en cookie ;

\* la pagination ;

\* les filtres ;

\* le tri ;

\* les exemples de payload ;

\* les codes d’erreur ;

\* les routes publiques et protégées.



Regroupe les endpoints avec des tags cohérents.



Ajoute les schémas de l’enveloppe standardisée.



Ne documente jamais un secret réel.



\---



\# 33. Module d’envoi d’e-mails



Crée un module d’e-mail technique et indépendant.



Définis un contrat de type :



```typescript

export interface MailProviderPort {

&#x20; send(message: MailMessage): Promise<MailDeliveryResult>;

}

```



Prévois deux implémentations :



1\. un adaptateur de développement qui journalise proprement les métadonnées de l’e-mail sans envoyer réellement le message ;

2\. un adaptateur SMTP basé sur une bibliothèque stable.



Ne journalise jamais le contenu sensible d’un e-mail.



Prévois notamment :



\* destinataire ;

\* sujet ;

\* contenu texte ;

\* contenu HTML facultatif ;

\* expéditeur ;

\* pièces jointes facultatives ;

\* gestion des erreurs ;

\* timeout ;

\* configuration typée.



Crée un cas d’utilisation de démonstration.



Un endpoint de démonstration peut être créé uniquement si :



```text

TECHNICAL\_DEMO\_ENDPOINTS\_ENABLED=true

```



Il doit être protégé par authentification.



Ajoute des tests unitaires sur le provider de développement.



\---



\# 34. Module de stockage de fichiers



Crée une abstraction :



```typescript

export interface FileStoragePort {

&#x20; save(file: FileToStore): Promise<StoredFile>;

&#x20; read(identifier: string): Promise<Readable>;

&#x20; delete(identifier: string): Promise<void>;

&#x20; exists(identifier: string): Promise<boolean>;

}

```



Implémente un stockage local.



Prévois :



\* chemin configurable ;

\* création automatique du répertoire ;

\* noms physiques générés avec UUID ;

\* conservation contrôlée du nom original ;

\* validation du type MIME ;

\* validation de la taille ;

\* protection contre les traversées de répertoires ;

\* aucune concaténation dangereuse de chemin ;

\* gestion des fichiers inexistants ;

\* suppression sécurisée ;

\* streaming pour les téléchargements.



Ne crée pas de table supplémentaire de métadonnées dans cette version.



Prépare clairement le remplacement futur par :



\* Azure Blob Storage ;

\* Amazon S3 ;

\* stockage réseau ;

\* autre fournisseur.



Crée des endpoints de démonstration uniquement lorsque :



```text

TECHNICAL\_DEMO\_ENDPOINTS\_ENABLED=true

```



Ils doivent être protégés par JWT.



Les réponses de téléchargement ne doivent pas utiliser l’enveloppe JSON standard.



Ajoute des tests avec un répertoire temporaire isolé.



\---



\# 35. Module de génération de PDF



Crée une abstraction :



```typescript

export interface PdfGeneratorPort {

&#x20; generate<TData>(template: string, data: TData): Promise<Buffer>;

}

```



Implémente une génération PDF locale avec une bibliothèque serveur stable.



Crée un PDF technique de démonstration comportant :



\* un titre ;

\* la date de génération ;

\* l’identifiant de l’utilisateur ;

\* le request ID ;

\* quelques données fictives non métier.



La génération doit retourner un `Buffer`.



Prévois un endpoint de démonstration protégé et activable uniquement par configuration.



Le PDF doit être renvoyé comme fichier téléchargeable.



Il ne doit pas être entouré de l’enveloppe JSON.



Ajoute des tests vérifiant :



\* que le buffer n’est pas vide ;

\* que le type de contenu est correct ;

\* que le fichier produit commence par une signature PDF valide.



\---



\# 36. Tâches planifiées



Utilise le module NestJS adapté aux tâches planifiées.



Crée un module `scheduler`.



Les tâches doivent pouvoir être globalement activées ou désactivées avec :



```text

SCHEDULER\_ENABLED

```



Crée une tâche technique de démonstration très légère.



Elle peut :



\* journaliser un heartbeat technique ;

\* nettoyer les sessions expirées ;

\* supprimer les fichiers temporaires anciens.



Privilégie le nettoyage des sessions expirées, car il correspond à un besoin réel du socle.



La tâche doit :



\* être idempotente ;

\* journaliser son début, sa fin et sa durée ;

\* gérer ses erreurs ;

\* éviter les exécutions concurrentes dans un même processus ;

\* pouvoir être testée sans attendre réellement le déclenchement du cron.



Documente les limites en cas de déploiement futur sur plusieurs instances.



\---



\# 37. Endpoints techniques de démonstration



Les endpoints servant uniquement à démontrer les briques techniques doivent être regroupés clairement.



Ils ne doivent être enregistrés que si :



```text

TECHNICAL\_DEMO\_ENDPOINTS\_ENABLED=true

```



Ils peuvent couvrir :



```text

POST /api/v1/technical-demo/mail

POST /api/v1/technical-demo/files

GET  /api/v1/technical-demo/files/:id

DELETE /api/v1/technical-demo/files/:id

GET  /api/v1/technical-demo/pdf

```



Ils doivent être :



\* protégés par JWT ;

\* clairement marqués comme endpoints de démonstration ;

\* documentés dans Swagger ;

\* désactivables ;

\* sans logique métier.



\---



\# 38. Transactions



Crée un service ou helper léger permettant d’exécuter une opération dans une transaction TypeORM.



Exemple de besoin :



```typescript

await transactionService.execute(async (manager) => {

&#x20; // Plusieurs opérations atomiques

});

```



Le helper doit :



\* utiliser `DataSource.transaction` ;

\* transmettre l’EntityManager transactionnel ;

\* propager correctement les erreurs ;

\* laisser TypeORM gérer le commit et le rollback ;

\* être documenté ;

\* comporter au moins un test d’intégration.



Ne crée pas de système complexe de Unit of Work si TypeORM couvre déjà le besoin.



\---



\# 39. Tests automatisés



Crée trois catégories de tests.



\## 39.1 Tests unitaires



Teste notamment :



\* validation de configuration ;

\* pagination ;

\* filtres ;

\* tri ;

\* erreurs standardisées ;

\* cas d’utilisation d’authentification ;

\* rotation des refresh tokens ;

\* détection de réutilisation ;

\* révocation de session ;

\* audit service ;

\* provider d’e-mail de développement ;

\* stockage local ;

\* génération PDF ;

\* tâche planifiée ;

\* mappers.



Les dépendances externes doivent être mockées lorsqu’il s’agit réellement d’un test unitaire.



\## 39.2 Tests d’intégration



Utilise la vraie base SQL Server de test.



Teste notamment :



\* repositories TypeORM ;

\* contraintes SQL ;

\* migrations ;

\* soft delete ;

\* transactions ;

\* création de session ;

\* révocation ;

\* requêtes paginées ;

\* persistance des audits.



Les tests doivent nettoyer leurs données.



Ils ne doivent pas dépendre de leur ordre d’exécution.



\## 39.3 Tests end-to-end



Utilise Supertest.



Teste au minimum le scénario complet :



1\. démarrage de l’application de test ;

2\. login valide ;

3\. login invalide ;

4\. accès à une route protégée ;

5\. accès refusé sans token ;

6\. récupération du profil ;

7\. récupération des sessions ;

8\. refresh du token ;

9\. rotation du refresh token ;

10\. refus d’un ancien refresh token ;

11\. révocation d’une session ;

12\. logout ;

13\. logout de toutes les sessions ;

14\. format standard des réponses ;

15\. format standard des erreurs ;

16\. validation des DTO ;

17\. endpoints de santé ;

18\. téléchargement d’un PDF de démonstration ;

19\. upload et téléchargement d’un fichier.



Prépare les helpers nécessaires pour manipuler proprement les cookies dans les tests.



Aucun seuil de couverture obligatoire ne doit être configuré.



La couverture doit néanmoins pouvoir être générée avec :



```text

npm run test:cov

```



\---



\# 40. Collection Postman



Crée une collection Postman complète.



Ajoute également un environnement Postman local.



La collection doit couvrir :



\* health ;

\* login ;

\* refresh ;

\* profile ;

\* sessions ;

\* révocation ;

\* logout ;

\* logout-all ;

\* e-mail de démonstration ;

\* fichiers ;

\* génération PDF.



Ajoute des scripts Postman permettant, lorsque cela est possible :



\* d’enregistrer automatiquement l’access token ;

\* d’enregistrer les identifiants utiles ;

\* de vérifier les codes HTTP ;

\* de vérifier la présence de `success` ;

\* de vérifier le request ID.



Les fichiers doivent être placés dans :



```text

postman/

```



\---



\# 41. Documentation attendue



Crée au minimum :



```text

README.md

CONTRIBUTING.md

docs/architecture.md

docs/getting-started.md

docs/configuration.md

docs/database.md

docs/migrations-and-seeds.md

docs/authentication.md

docs/sso-extension-guide.md

docs/authorization-extension-guide.md

docs/observability.md

docs/error-handling.md

docs/testing.md

docs/create-a-module.md

docs/mail.md

docs/file-storage.md

docs/pdf-generation.md

docs/scheduled-tasks.md

docs/security.md

```



La documentation doit être rédigée en français.



\## 41.1 README



Le README doit contenir :



\* présentation du socle ;

\* prérequis ;

\* installation ;

\* démarrage de SQL Server ;

\* initialisation des bases ;

\* variables d’environnement ;

\* migrations ;

\* seeders ;

\* lancement de NestJS ;

\* accès Swagger ;

\* accès SQL Server Management Studio ;

\* exécution des tests ;

\* architecture générale ;

\* commandes npm ;

\* résolution des problèmes fréquents.



\## 41.2 Guide de création d’un module



Le fichier `docs/create-a-module.md` doit expliquer, avec un exemple concret, comment créer un futur module respectant l’architecture :



```text

domain

application

infrastructure

presentation

```



Il doit expliquer :



\* où placer une entité ;

\* où placer une interface de repository ;

\* où placer une entité TypeORM ;

\* où placer un cas d’utilisation ;

\* où placer un DTO ;

\* comment déclarer les providers ;

\* comment ajouter Swagger ;

\* comment ajouter une migration ;

\* comment ajouter des tests ;

\* comment ajouter un audit ;

\* comment utiliser la pagination.



\## 41.3 Documentation d’architecture



Ajoute au moins une décision d’architecture dans :



```text

docs/adr/0001-modular-clean-architecture.md

```



Elle doit expliquer :



\* le contexte ;

\* la décision ;

\* les avantages ;

\* les inconvénients ;

\* pourquoi les microservices ne sont pas préparés ;

\* pourquoi l’architecture reste pragmatique.



\---



\# 42. Scripts npm attendus



Prépare des scripts cohérents couvrant au minimum :



```text

npm run start

npm run start:dev

npm run start:debug

npm run build



npm run lint

npm run lint:fix

npm run format

npm run format:check



npm run test

npm run test:unit

npm run test:integration

npm run test:e2e

npm run test:cov



npm run docker:db:up

npm run docker:db:down

npm run docker:db:restart

npm run docker:db:logs

npm run docker:db:status



npm run db:init

npm run db:reset:test



npm run migration:create

npm run migration:generate

npm run migration:run

npm run migration:revert

npm run migration:show

npm run migration:run:test



npm run seed

npm run seed:test

```



Chaque script doit être documenté dans le README.



\---



\# 43. Git



Le dossier ne contient initialement aucun dépôt.



Initialise un dépôt Git local si nécessaire.



Crée un `.gitignore` complet couvrant notamment :



```text

node\_modules

dist

coverage

.env

.env.local

.env.development

.env.test

logs

uploads

temporary files

IDE files

```



Ne committe jamais :



\* secrets ;

\* mots de passe ;

\* données SQL Server ;

\* fichiers téléversés ;

\* logs ;

\* rapports de couverture ;

\* builds.



Le projet sera ultérieurement hébergé sur GitHub.



Ne crée aucune pipeline GitHub Actions.



Ne crée aucun commit automatiquement sans demande explicite.



\---



\# 44. Éléments à ne pas implémenter



Ne développe pas :



\* microservices ;

\* message broker ;

\* RabbitMQ ;

\* Kafka ;

\* Redis ;

\* BullMQ ;

\* WebSockets ;

\* GraphQL ;

\* rôles définitifs ;

\* permissions définitives ;

\* fournisseur SSO concret ;

\* interface utilisateur ;

\* logique de mini-ERP ;

\* pipeline CI/CD ;

\* Kubernetes ;

\* Grafana ;

\* Loki ;

\* Elasticsearch ;

\* Kibana ;

\* stockage cloud concret ;

\* couverture minimale bloquante.



L’architecture peut prévoir des points d’extension, mais ne doit pas intégrer des dépendances inutiles.



\---



\# 45. Critères de qualité



Le projet final doit respecter les principes suivants :



\* aucune dépendance cyclique ;

\* aucune logique métier dans les contrôleurs ;

\* aucun repository TypeORM utilisé directement dans un contrôleur ;

\* aucune configuration lue directement avec `process.env` en dehors du système de configuration ;

\* aucune donnée sensible dans les logs ;

\* aucun refresh token stocké en clair ;

\* aucune synchronisation automatique TypeORM ;

\* aucune requête SQL construite à partir d’un nom de colonne non validé ;

\* aucune exception SQL brute renvoyée au client ;

\* aucun `any` injustifié ;

\* aucun endpoint de démonstration actif sans configuration explicite ;

\* aucune route protégée accessible sans authentification ;

\* aucune documentation Swagger incomplète sur les endpoints publics ;

\* aucune migration manquante ;

\* aucune suite de tests dépendante d’un ordre d’exécution.



\---



\# 46. Ordre d’exécution obligatoire



Réalise les étapes dans cet ordre.



\## Étape 1 — Audit initial



\* inspecter le workspace ;

\* confirmer qu’il est vide ou identifier les fichiers existants ;

\* ne supprimer aucun fichier utilisateur sans justification ;

\* créer `IMPLEMENTATION\_PROGRESS.md`.



\## Étape 2 — Initialisation



\* initialiser NestJS ;

\* initialiser Git ;

\* configurer npm ;

\* générer le lockfile ;

\* créer `.gitignore` ;

\* créer `.editorconfig`.



\## Étape 3 — TypeScript et qualité



\* activer le mode strict ;

\* configurer ESLint ;

\* configurer Prettier ;

\* ajouter les scripts de qualité ;

\* exécuter lint et build.



\## Étape 4 — Architecture initiale



\* créer l’arborescence cible ;

\* créer les modules vides ;

\* définir les règles de dépendance ;

\* documenter l’architecture.



\## Étape 5 — Configuration



\* créer la configuration typée ;

\* créer la validation des variables ;

\* créer les fichiers `.env.example` ;

\* tester le refus de démarrage en cas de configuration invalide.



\## Étape 6 — Docker SQL Server



\* créer `docker-compose.yml` ;

\* créer le volume ;

\* créer le health check ;

\* créer les scripts npm Docker ;

\* démarrer SQL Server ;

\* vérifier son état.



\## Étape 7 — Initialisation des bases



\* créer le script `db:init` ;

\* créer les bases locale et de test ;

\* vérifier la connexion depuis l’application ;

\* documenter la connexion SSMS.



\## Étape 8 — TypeORM



\* configurer TypeORM ;

\* créer le DataSource CLI ;

\* désactiver `synchronize` ;

\* créer les helpers de transaction ;

\* créer les scripts de migrations.



\## Étape 9 — Entités et migrations



\* créer `users` ;

\* créer `auth\_sessions` ;

\* créer `audit\_logs` ;

\* générer ou écrire les migrations ;

\* exécuter les migrations ;

\* vérifier le schéma.



\## Étape 10 — Seeders



\* créer les seeders ;

\* insérer les utilisateurs techniques ;

\* vérifier l’idempotence ;

\* créer les commandes npm.



\## Étape 11 — Composants communs



\* pagination ;

\* filtres ;

\* tri ;

\* recherche ;

\* types de réponse ;

\* décorateurs communs ;

\* utilities ;

\* tests unitaires.



\## Étape 12 — Validation et erreurs



\* configurer le ValidationPipe ;

\* créer les exceptions applicatives ;

\* créer le filtre global ;

\* standardiser les erreurs ;

\* tester les formats.



\## Étape 13 — Enveloppe des réponses



\* créer l’interceptor ;

\* gérer les réponses paginées ;

\* gérer les exclusions ;

\* ajouter le request ID ;

\* tester les réponses.



\## Étape 14 — Logging et contexte



\* installer Pino ;

\* créer le request ID ;

\* créer le contexte de requête ;

\* configurer la redaction ;

\* journaliser la durée des requêtes ;

\* tester les informations de contexte.



\## Étape 15 — Audit



\* créer le module d’audit ;

\* créer le repository ;

\* créer le service ;

\* enregistrer les événements de sécurité ;

\* tester la persistance.



\## Étape 16 — Sécurité HTTP



\* intégrer Helmet ;

\* configurer CORS ;

\* configurer les limites de requête ;

\* configurer le rate limiting ;

\* renforcer les endpoints d’authentification.



\## Étape 17 — Utilisateurs



\* créer le domaine utilisateur ;

\* créer le repository ;

\* créer les mappers ;

\* créer les cas d’utilisation internes ;

\* ajouter les tests.



\## Étape 18 — Authentification



\* implémenter le login ;

\* implémenter les JWT ;

\* implémenter les sessions ;

\* implémenter les refresh tokens ;

\* implémenter la rotation ;

\* implémenter la réutilisation ;

\* implémenter logout et logout-all ;

\* implémenter la gestion des sessions ;

\* ajouter les audits ;

\* ajouter les tests.



\## Étape 19 — Préparation SSO



\* créer les contrats ;

\* intégrer le provider local ;

\* documenter l’ajout d’un provider externe ;

\* ne créer aucun faux provider SSO.



\## Étape 20 — Préparation des permissions



\* créer les contrats neutres ;

\* préparer les types ;

\* documenter RBAC et permissions ;

\* ne pas activer un faux système permissif.



\## Étape 21 — Swagger



\* configurer OpenAPI ;

\* documenter les endpoints ;

\* documenter les enveloppes ;

\* documenter JWT et cookie ;

\* vérifier le fichier JSON généré.



\## Étape 22 — Santé



\* créer les endpoints health ;

\* ajouter la vérification SQL Server ;

\* ajouter les tests.



\## Étape 23 — Métriques



\* intégrer Prometheus ;

\* créer `/metrics` ;

\* exclure l’enveloppe ;

\* contrôler les labels ;

\* ajouter les tests utiles.



\## Étape 24 — E-mails



\* créer le port ;

\* créer le provider de développement ;

\* créer le provider SMTP ;

\* créer le cas de démonstration ;

\* ajouter les tests.



\## Étape 25 — Fichiers



\* créer le port ;

\* créer le stockage local ;

\* sécuriser les chemins ;

\* créer les endpoints de démonstration ;

\* ajouter les tests.



\## Étape 26 — PDF



\* créer le port ;

\* créer le provider ;

\* créer le PDF de démonstration ;

\* créer l’endpoint ;

\* ajouter les tests.



\## Étape 27 — Scheduler



\* créer le module ;

\* créer le nettoyage des sessions ;

\* empêcher les exécutions concurrentes locales ;

\* ajouter les tests.



\## Étape 28 — Tests d’intégration



\* préparer la base de test ;

\* exécuter les migrations ;

\* tester les repositories ;

\* tester les transactions ;

\* tester les audits.



\## Étape 29 — Tests end-to-end



\* tester tout le cycle d’authentification ;

\* tester les cookies ;

\* tester les réponses ;

\* tester les erreurs ;

\* tester les modules techniques.



\## Étape 30 — Postman



\* créer la collection ;

\* créer l’environnement ;

\* ajouter les scripts automatiques ;

\* vérifier les requêtes.



\## Étape 31 — Documentation



\* compléter le README ;

\* compléter les guides ;

\* compléter les ADR ;

\* compléter CONTRIBUTING ;

\* vérifier les commandes.



\## Étape 32 — Validation finale



Exécuter obligatoirement :



```text

npm ci

npm run lint

npm run format:check

npm run build

npm run test:unit

npm run test:integration

npm run test:e2e

npm run test:cov

```



Exécuter également :



```text

npm run docker:db:up

npm run db:init

npm run migration:run

npm run seed

```



Corriger toutes les erreurs.



\---



\# 47. Bilan final attendu



À la fin, produis un bilan contenant :



\## Architecture



\* modules créés ;

\* responsabilités ;

\* principales décisions ;

\* points d’extension.



\## Base de données



\* bases créées ;

\* tables créées ;

\* migrations ;

\* seeders ;

\* méthode de connexion SSMS.



\## Sécurité



\* fonctionnement JWT ;

\* fonctionnement des sessions ;

\* rotation des refresh tokens ;

\* révocation ;

\* protection HTTP ;

\* éléments sensibles filtrés.



\## Observabilité



\* logs ;

\* audits ;

\* request ID ;

\* health checks ;

\* métriques.



\## Modules techniques



\* e-mails ;

\* fichiers ;

\* PDF ;

\* tâches planifiées.



\## Tests



\* tests exécutés ;

\* résultat de chaque suite ;

\* couverture informative ;

\* éventuelles limitations.



\## Documentation



\* liste des documents créés ;

\* collection Postman ;

\* commandes principales.



\## État final



Indique explicitement :



\* si le projet compile ;

\* si le lint passe ;

\* si les tests unitaires passent ;

\* si les tests d’intégration passent ;

\* si les tests end-to-end passent ;

\* si les migrations fonctionnent ;

\* si le seeder fonctionne ;

\* si Swagger est accessible ;

\* si l’application démarre correctement.



Ne déclare jamais une étape réussie sans avoir exécuté la commande correspondante.



Lorsque l’environnement empêche l’exécution d’une commande, indique clairement :



\* la commande concernée ;

\* la raison ;

\* ce qui a malgré tout été vérifié ;

\* la procédure exacte permettant au développeur de terminer la validation.



