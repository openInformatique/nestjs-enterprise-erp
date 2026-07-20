# Observabilité

## Logs techniques (Pino)

- **JSON structuré** sur stdout ; en local, sortie lisible via pino-pretty ;
- niveau configurable (`LOG_LEVEL`) ;
- chaque ligne HTTP porte : request ID, méthode, route, statut, durée, IP,
  user-agent, et userId/sessionId lorsque l'utilisateur est authentifié ;
- **redaction stricte** : `authorization`, `cookie`, `set-cookie`,
  `password*`, `accessToken`, `refreshToken*`, secrets JWT, mots de passe
  mail/base → `[REDACTED]`.

### Collecte future

Le socle n'embarque volontairement AUCUNE stack de collecte. Les logs JSON
sur stdout sont directement exploitables par :

- **Grafana Loki** (promtail/alloy sur les logs Docker ou systemd) ;
- **Elasticsearch/Kibana** (filebeat) ;
- tout collecteur compatible avec les logs JSON de Docker.

Aucune modification du cœur de l'application n'est nécessaire : brancher le
collecteur sur stdout/les fichiers de logs du conteneur suffit.

## Journal d'audit (persistant)

À ne pas confondre avec les logs techniques : la table `audit_logs` conserve
les ÉVÉNEMENTS significatifs (connexions, révocations, réutilisation de token,
actions techniques). Voir `AuditService` — audit explicite déclaré par les cas
d'utilisation, valeurs sensibles filtrées, enregistrements immuables (aucun
endpoint de modification/suppression).

Corrélation : les audits portent le même `request_id` que les logs Pino.

## Request ID

- réutilise l'en-tête `x-request-id` entrant s'il est valide (format
  contrôlé), sinon génère un UUID ;
- renvoyé dans l'en-tête de réponse `x-request-id` ;
- présent dans les logs, les audits et le champ `meta.requestId` des réponses ;
- porté par un contexte `AsyncLocalStorage` (`RequestContextService`)
  accessible à tout service sans propagation manuelle.

## Santé

| Endpoint | Rôle |
| --- | --- |
| `GET /api/v1/health/live` | Le processus répond (liveness) |
| `GET /api/v1/health/ready` | SQL Server joignable (readiness) |
| `GET /api/v1/health` | Synthèse |

Publics (sondes d'infrastructure) ; n'exposent ni secret ni chaîne de
connexion — uniquement des statuts up/down.

## Métriques Prometheus

`GET /metrics` (hors préfixe /api, hors enveloppe JSON, désactivable via
`METRICS_ENABLED`) :

- métriques processus Node.js (CPU, mémoire, GC, event loop) ;
- `http_requests_total{method, route, status}` ;
- `http_request_duration_seconds{method, route, status}` (histogramme).

Cardinalité maîtrisée : les labels contiennent la route NORMALISÉE (gabarit
`/api/v1/auth/sessions/:id`), jamais d'identifiant utilisateur/session, de
request ID, d'URL réelle ni d'adresse IP.

⚠️ **En production, `/metrics` doit être protégé** : réseau privé, règle de
reverse proxy ou authentification dédiée. Le socle le laisse accessible car
seuls les environnements local/développement/test sont gérés.
