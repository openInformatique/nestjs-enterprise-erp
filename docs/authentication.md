# Authentification

## Vue d'ensemble

Le socle fournit une authentification locale (e-mail + mot de passe) servant de
fournisseur d'identité initial en attendant le choix du SSO définitif
(voir [sso-extension-guide.md](sso-extension-guide.md)).

Deux jetons distincts, signés avec des **secrets différents** :

| | Access token | Refresh token |
| --- | --- | --- |
| Durée | courte (`JWT_ACCESS_EXPIRATION`, ex. 15 min) | longue (`JWT_REFRESH_EXPIRATION`, ex. 7 j) |
| Transport | corps de réponse + `Authorization: Bearer` | cookie **HttpOnly** `refresh_token` |
| Stockage serveur | aucun | **empreinte SHA-256 uniquement** (jamais en clair) |
| Claims | `sub` (user), `sid` (session), `jti`, `iat`, `exp` | identiques |

Le cookie de refresh token est limité au chemin `/api/v1/auth`, `Secure` et
`SameSite` configurables par environnement, et n'est jamais accessible au
JavaScript du front.

## Déroulé du login

1. normalisation de l'e-mail (minuscules, espaces retirés) ;
2. recherche de l'utilisateur ; vérification qu'il existe, est actif, non
   supprimé et possède un mot de passe local ;
3. vérification du mot de passe (Argon2id) — en cas de compte inconnu, une
   vérification factice est exécutée pour un temps de réponse homogène
   (anti-énumération) ;
4. création d'une session avec une nouvelle **famille de tokens** ;
5. génération des deux jetons ; seule l'empreinte du refresh token est stockée ;
6. audit de sécurité `auth.login.success` ;
7. mise à jour de `last_login_at`.

Tout échec renvoie le même message générique (`AUTHENTICATION_FAILED`,
« Identifiants incorrects. ») et un audit `auth.login.failed`.

## Rotation des refresh tokens

À chaque `POST /auth/refresh` :

1. vérification de la signature du refresh token (cookie) ;
2. récupération de la session via le claim `sid` ;
3. **comparaison de l'empreinte** du token reçu avec celle stockée ;
4. vérification de la révocation puis de l'expiration de la session ;
5. génération d'un nouveau refresh token, remplacement de l'empreinte stockée,
   mise à jour de `last_used_at` ;
6. nouveau access token renvoyé, nouveau cookie déposé.

L'ancien refresh token devient immédiatement inutilisable.

## Détection de réutilisation

Si un token **cryptographiquement valide** mais dont l'empreinte ne correspond
plus à celle stockée est présenté (c'est-à-dire un ancien token rejoué après
rotation) :

- la session est considérée compromise ;
- **toute la famille de tokens est révoquée** (raison `TOKEN_REUSE_DETECTED`) ;
- un audit de sécurité `auth.refresh-token.reuse-detected` est enregistré ;
- la requête est refusée avec le code `REFRESH_TOKEN_REUSE_DETECTED`.

Ce mécanisme protège contre le vol de refresh token : le voleur ou la victime
finira par rejouer un token périmé, ce qui invalide l'ensemble.

## Révocation et sessions

- `POST /auth/logout` : révoque la session courante et supprime le cookie ;
- `DELETE /auth/sessions/:id` : révoque une session précise — uniquement les
  siennes ; la session d'un autre utilisateur est traitée comme introuvable ;
- `POST /auth/logout-all` : révoque toutes les sessions de l'utilisateur ;
- `GET /auth/sessions` : liste les sessions actives (la session courante est
  marquée `isCurrent`).

Une session révoquée ne peut plus JAMAIS rafraîchir de jeton.

## Limite documentée : validité de l'access token après révocation

Le guard JWT **ne vérifie pas l'état de la session en base à chaque requête**
(choix de performance standard). Un access token déjà émis reste donc
techniquement valide jusqu'à sa courte expiration, même si la session vient
d'être révoquée.

Si un besoin de révocation instantanée apparaît, ajouter dans `JwtAuthGuard`
une vérification de session (`AuthSessionRepositoryPort.findById` +
`isUsable()`), au prix d'une requête SQL par appel.

## Rate limiting

- `POST /auth/login` : 5 requêtes/min/IP ;
- `POST /auth/refresh` : 30 requêtes/min/IP ;
- reste de l'API : 100 requêtes/min/IP.

## Ce qui n'est JAMAIS stocké ni journalisé

Mot de passe (clair), access token, refresh token (clair), contenu des cookies
d'authentification. Les logs Pino redactent `authorization`, `cookie`,
`set-cookie`, `password*`, `*Token*`, etc. ; l'AuditService filtre les clés
sensibles des métadonnées avant insertion.
