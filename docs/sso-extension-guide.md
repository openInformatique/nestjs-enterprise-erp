# Ajouter un fournisseur SSO

Le fournisseur définitif (Microsoft Entra ID, OpenID Connect, AD/Kerberos,
authentification Windows intégrée...) n'est pas encore choisi. Le socle
prépare son intégration SANS simuler de faux SSO.

## Ce qui existe déjà

Dans `src/modules/authentication/domain/identity-provider.port.ts` :

- `IdentityProviderPort` : contrat unique d'authentification ;
- `AuthenticationInput` : union discriminée `local` (e-mail + mot de passe) /
  `external` (fournisseur + credentials opaques) ;
- `AuthenticatedIdentity` : identité résolue vers un utilisateur INTERNE
  (`userId` de la table `users`) ;
- jeton d'injection `IDENTITY_PROVIDER`, aujourd'hui lié à
  `LocalIdentityProvider` (e-mail + Argon2id).

Les cas d'utilisation (login, sessions, jetons) ne connaissent QUE le port :
ajouter un fournisseur ne les modifie pas.

## Étapes d'intégration (exemple : OpenID Connect)

1. **Créer l'adaptateur** dans
   `src/modules/authentication/infrastructure/` :

   ```typescript
   @Injectable()
   export class OidcIdentityProvider implements IdentityProviderPort {
     async authenticate(input: AuthenticationInput): Promise<AuthenticatedIdentity> {
       if (input.type !== 'external' || input.provider !== 'oidc') {
         throw new AuthenticationFailedException();
       }
       // 1. Valider le code/jeton auprès de l'IdP (bibliothèque openid-client).
       // 2. Extraire les claims (sub, email, name).
       // 3. Lier l'identité externe à un utilisateur interne (voir ci-dessous).
       // 4. Retourner { userId, email, displayName }.
     }
   }
   ```

2. **Lier l'identité externe à un utilisateur interne.** La table `users`
   prévoit déjà `authentication_source = 'SSO'` et `password_hash` nullable.
   Selon la politique retenue :
   - *provisioning automatique* : créer l'utilisateur à la première connexion ;
   - *pré-provisioning* : refuser si l'e-mail n'existe pas déjà.
   Si l'identifiant stable de l'IdP doit être conservé (claim `sub`/`oid`),
   ajouter une colonne `external_subject` (+ index unique) par migration.

3. **Composer les fournisseurs.** Remplacer le binding ou créer un
   agrégateur qui route selon `input.type` / `input.provider` :

   ```typescript
   {
     provide: IDENTITY_PROVIDER,
     inject: [LocalIdentityProvider, OidcIdentityProvider],
     useFactory: (local, oidc) => new CompositeIdentityProvider([local, oidc]),
   }
   ```

4. **Exposer le flux HTTP** propre au protocole (redirection OIDC, callback,
   négociation Kerberos...) dans la couche presentation du module. Le callback
   appelle un cas d'utilisation qui délègue au port puis réutilise la
   MÊME création de session/jetons que le login local : le SSO bénéficie
   automatiquement de la rotation, de la détection de réutilisation et des
   audits.

5. **Configuration** : ajouter les variables (client ID, issuer, tenant...)
   dans `environment.validation.ts` + un fichier `sso.config.ts`.

6. **Tests** : unitaires sur l'adaptateur (IdP mocké), e2e sur le flux.

## Règles à respecter

- une authentification échouée lève TOUJOURS `AuthenticationFailedException`
  (générique) ;
- ne jamais journaliser les jetons/assertions de l'IdP ;
- les comptes SSO n'ont pas de mot de passe local (`password_hash = NULL`) —
  `LocalIdentityProvider` les refuse déjà ;
- ne pas créer d'implémentation factice « pour tester » : brancher un vrai IdP
  de développement (Entra ID tenant de dev, Keycloak...).
