# Gestion des erreurs

## Format standardisé

Toute erreur renvoyée par l'API suit ce format :

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données transmises sont invalides.",
    "details": [
      { "field": "email", "message": "L’adresse e-mail n’est pas valide." }
    ]
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-07-14T08:30:00.000Z",
    "path": "/api/v1/auth/login"
  }
}
```

`error.details` n'apparaît que pour les erreurs de validation. `meta.requestId`
permet de retrouver les logs techniques correspondants.

## Codes d'erreur stables (contrat d'API)

| Code | HTTP | Signification |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Données d'entrée invalides |
| `AUTHENTICATION_FAILED` | 401 | Identifiants incorrects (message générique) |
| `ACCESS_TOKEN_INVALID` | 401 | Jeton d'accès absent, invalide ou expiré |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token absent ou invalide |
| `SESSION_EXPIRED` | 401 | Session expirée |
| `SESSION_REVOKED` | 401 | Session révoquée |
| `REFRESH_TOKEN_REUSE_DETECTED` | 401 | Ancien token rejoué → famille révoquée |
| `RESOURCE_NOT_FOUND` | 404 | Ressource inexistante |
| `RESOURCE_ALREADY_EXISTS` | 409 | Conflit d'unicité |
| `DATABASE_ERROR` | 500 | Erreur d'accès aux données (détail en log uniquement) |
| `FILE_NOT_FOUND` | 404 | Fichier inconnu |
| `FILE_TYPE_NOT_ALLOWED` | 400 | Type MIME refusé |
| `FILE_TOO_LARGE` | 413 | Taille maximale dépassée |
| `TOO_MANY_REQUESTS` | 429 | Rate limiting |
| `INTERNAL_SERVER_ERROR` | 500 | Erreur inconnue (message générique) |

Les consommateurs doivent s'appuyer sur `error.code` (stable), jamais sur
`error.message` (destiné aux humains, susceptible d'évoluer).

## Fonctionnement interne

- **Hiérarchie applicative** : `AppException` (code + message français +
  statut) et ses sous-classes dans `src/common/exceptions/app-exceptions.ts` ;
  les cas d'utilisation lèvent ces exceptions.
- **Filtre global** (`GlobalExceptionFilter`) :
  - AppException → contrat conservé tel quel ;
  - erreurs TypeORM → `DATABASE_ERROR` générique, AUCUN détail SQL exposé ;
  - HttpException NestJS (404 de route, 429...) → code déduit du statut ;
  - toute erreur inconnue → `INTERNAL_SERVER_ERROR` générique ;
  - chaque erreur est journalisée avec le request ID (warn pour les 4xx,
    error + stack pour les 5xx) — la stack n'est JAMAIS renvoyée au client.
- **Validation** : le `ValidationPipe` global (whitelist +
  forbidNonWhitelisted + transform) convertit les erreurs class-validator en
  `ValidationException` avec le détail champ par champ, y compris imbriqué
  (`parent.enfant`). La valeur soumise n'est jamais renvoyée (elle pourrait
  contenir un secret).

## Ajouter un code d'erreur

1. ajouter l'entrée dans `ErrorCode` (`error-code.enum.ts`) ;
2. créer l'exception dans `app-exceptions.ts` (message français) ;
3. documenter ici et dans la description Swagger ;
4. tester le format via un test e2e.
