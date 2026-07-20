# Sécurité

## Authentification et sessions

Voir [authentication.md](authentication.md) : Argon2id, JWT à double secret,
refresh token en cookie HttpOnly haché en base (SHA-256), rotation,
détection de réutilisation avec révocation de famille, révocation de sessions.

## Sécurité HTTP

| Mesure | Implémentation |
| --- | --- |
| En-têtes de sécurité | Helmet (CSP, HSTS, no-sniff, frameguard...) |
| Pile masquée | `X-Powered-By` désactivé |
| CORS | Liste blanche stricte (`APP_CORS_ORIGINS`), credentials activés, jamais d'origine `*` |
| Taille des corps | JSON/urlencoded limités à 1 Mo ; uploads bornés par `STORAGE_MAX_FILE_SIZE` |
| Rate limiting | 100 req/min/IP global ; login 5/min ; refresh 30/min (429 `TOO_MANY_REQUESTS`) |
| Validation | ValidationPipe global : whitelist + forbidNonWhitelisted + transform |
| Endpoints techniques | /metrics désactivable ; endpoints démo désactivés par défaut hors local |

## Protection des données sensibles

- **Jamais stockés** : mot de passe en clair, access/refresh token en clair ;
- **Jamais journalisés** : mots de passe, hash, jetons, cookies — redaction
  Pino + filtrage AuditService ;
- **Jamais exposés** : détails SQL, stack traces (logs uniquement, et stack
  détaillée seulement en local), existence d'un compte (message de login
  générique + vérification factice anti-énumération temporelle).

## Injection SQL

- toutes les valeurs passent par des paramètres TypeORM ;
- aucun nom de colonne issu de l'utilisateur : tri et filtres uniquement via
  les **listes blanches** des modules (`TypeOrmFilterHelper`) — une colonne
  hors liste est rejetée en 400 ;
- les jokers `%`, `_`, `[` des recherches LIKE sont échappés.

## Fichiers

- noms physiques générés (UUID) : le nom original ne participe jamais au
  chemin ;
- identifiants validés par expression régulière stricte + vérification que le
  chemin résolu reste dans le répertoire de stockage (anti-traversée) ;
- type MIME et taille validés avant écriture ;
- téléchargements en streaming.

## Autorisations

Cette version impose UNIQUEMENT l'authentification (guard JWT global, routes
publiques explicites via `@Public()`). Le modèle de rôles/permissions sera
branché via les contrats neutres existants
([authorization-extension-guide.md](authorization-extension-guide.md)) —
aucun faux système permissif n'est actif.

## Recommandations avant production

- servir l'API derrière HTTPS et passer `REFRESH_COOKIE_SECURE=true` ;
- protéger `/metrics` (réseau, proxy ou authentification) ;
- stocker les secrets dans un coffre (variables d'environnement injectées, pas
  de fichiers .env) ;
- ajouter l'environnement `production` à la validation de configuration ;
- envisager la vérification de session systématique dans le guard JWT si la
  révocation instantanée devient une exigence.
