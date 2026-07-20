# Ajouter les rôles et permissions

Le modèle définitif n'est pas choisi : le socle n'a AUCUNE table de rôle ni de
permission et n'active aucun faux système permissif. Seule l'authentification
est imposée (guard JWT global). Ce guide décrit le chemin d'intégration prévu.

## Ce qui existe déjà

Dans `src/modules/authentication/domain/authorization.port.ts` :

- `Permission` : permission unitaire (`'users.read'`) ;
- `AuthorizationRequirement` : permission requise, éventuellement
  contextualisée par une ressource ;
- `AuthorizationPort.isAllowed(user, requirement)` : contrat d'évaluation ;
- jeton `AUTHORIZATION_PORT` (aucune implémentation liée).

Et dans `src/common/decorators/requires-permission.decorator.ts` :

- `@RequiresPermission({ permission: 'users.read' })` : pose des métadonnées
  sur les handlers — AUCUN guard ne les évalue aujourd'hui.

## Chemin d'intégration

### 1. Choisir le modèle

- **Permissions unitaires** : table `permissions` + table de liaison
  utilisateur/permission ;
- **RBAC** : tables `roles`, `role_permissions`, `user_roles` — les rôles
  regroupent des permissions, l'évaluation reste par permission ;
- **Règles contextuelles** : l'implémentation d'`AuthorizationPort` combine la
  permission et la ressource (`requirement.resourceType/resourceId`), par
  exemple « propriétaire uniquement ».

Dans tous les cas, garder `isAllowed()` comme UNIQUE point d'évaluation : le
modèle sous-jacent reste remplaçable.

### 2. Créer les tables par migrations

```bash
npm run migration:generate -- src/database/migrations/CreateRolesAndPermissionsTables
```

### 3. Implémenter le port

```typescript
@Injectable()
export class RbacAuthorizationService implements AuthorizationPort {
  async isAllowed(
    user: AuthenticatedUser,
    requirement: AuthorizationRequirement,
  ): Promise<boolean> {
    // Charger (et mettre en cache) les permissions effectives de user.userId,
    // puis vérifier requirement.permission (+ contexte éventuel).
  }
}
```

Binding : `{ provide: AUTHORIZATION_PORT, useClass: RbacAuthorizationService }`.

### 4. Créer le guard

```typescript
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTHORIZATION_PORT) private readonly authorization: AuthorizationPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirements = this.reflector.getAllAndOverride<AuthorizationRequirement[]>(
      AUTHORIZATION_REQUIREMENTS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirements || requirements.length === 0) {
      return true; // Pas d'exigence déclarée : authentification seule.
    }
    const user = context.switchToHttp().getRequest<RequestWithUser>().user!;
    for (const requirement of requirements) {
      if (!(await this.authorization.isAllowed(user, requirement))) {
        throw new ForbiddenException('Accès refusé.');
      }
    }
    return true;
  }
}
```

L'enregistrer comme guard global APRÈS `JwtAuthGuard` (l'ordre suit l'ordre
d'enregistrement des providers `APP_GUARD`).

### 5. Décorer les endpoints

`@RequiresPermission({ permission: 'projects.create' })` sur les handlers —
les métadonnées existent déjà, elles deviennent effectives dès que le guard
est en place.

### 6. Compléter

- claims : NE PAS embarquer les permissions dans le JWT (invalidation
  impossible avant expiration) ; les évaluer côté serveur, avec cache si
  nécessaire ;
- audit : enregistrer les refus significatifs (`SECURITY`) ;
- tests : unitaires sur l'implémentation du port, e2e sur les 403.
