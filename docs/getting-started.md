# Prise en main

## 1. Prérequis

- Node.js 24 LTS (`node --version`)
- npm ≥ 10
- Docker Desktop démarré

## 2. Installation

```bash
npm ci
```

## 3. Configuration

```bash
cp .env.example .env.local
```

À renseigner obligatoirement dans `.env.local` :

- `DB_PASSWORD` : mot de passe SQL Server fort (il servira à la création du
  conteneur — voir la remarque « volume » plus bas) ;
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` : deux secrets DISTINCTS d'au
  moins 32 caractères :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Pour les tests : `cp .env.test.example .env.test` puis reporter le même
`DB_PASSWORD` et générer d'autres secrets JWT.

## 4. Base de données

```bash
npm run docker:db:up      # démarre SQL Server 2022 (conteneur seul)
npm run docker:db:status  # attendre l'état "healthy"
npm run db:init           # crée nestjs_starter_local et nestjs_starter_test
npm run migration:run     # schéma de la base locale
npm run migration:run:test # schéma de la base de test
npm run seed              # utilisateurs techniques (mots de passe affichés)
```

⚠️ Le mot de passe `sa` est fixé à la PREMIÈRE création du volume Docker.
Changer `DB_PASSWORD` ensuite ne suffit pas : supprimer le volume
(`docker volume rm nestjs-starter-sqlserver-data`) et réinitialiser.

## 5. Lancement

```bash
npm run start:dev
```

- API : `http://localhost:3000/api/v1`
- Swagger : `http://localhost:3000/api/docs`
- Métriques : `http://localhost:3000/metrics`

Premier appel :

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local.dev","password":"<mot de passe du seed>"}'
```

## 6. Vérification complète

```bash
npm run lint
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
```

## L'application refuse de démarrer ?

C'est voulu : la configuration est validée au démarrage. Le message d'erreur
liste chaque variable manquante ou invalide — corriger `.env.local` en
s'appuyant sur `.env.example`.
