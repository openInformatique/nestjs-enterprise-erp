import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { ListSessionsUseCase } from './application/list-sessions.use-case';
import { LoginUseCase } from './application/login.use-case';
import { LogoutAllUseCase } from './application/logout-all.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { RefreshTokensUseCase } from './application/refresh-tokens.use-case';
import { RevokeSessionUseCase } from './application/revoke-session.use-case';
import { TokenService } from './application/token.service';
import { AUTH_SESSION_REPOSITORY } from './domain/auth-session-repository.port';
import { IDENTITY_PROVIDER } from './domain/identity-provider.port';
import { PASSWORD_HASHER } from './domain/password-hasher.port';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { AuthSessionMapper } from './infrastructure/auth-session.mapper';
import { AuthSessionEntity } from './infrastructure/entities/auth-session.entity';
import { LocalIdentityProvider } from './infrastructure/local-identity.provider';
import { TypeOrmAuthSessionRepository } from './infrastructure/typeorm-auth-session.repository';
import { AuthenticationController } from './presentation/authentication.controller';
import { JwtAuthGuard } from './presentation/jwt-auth.guard';
import { RefreshCookieService } from './presentation/refresh-cookie.service';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Module d'authentification.
 *
 * Points structurants :
 *   - JwtAuthGuard est enregistré GLOBALEMENT : toute route est protégée
 *     par défaut, sauf décoration @Public() ;
 *   - le fournisseur d'identité est injecté via IDENTITY_PROVIDER : le
 *     fournisseur local pourra être remplacé ou complété par un SSO sans
 *     toucher aux cas d'utilisation (docs/sso-extension-guide.md) ;
 *   - JwtModule est enregistré sans secret : chaque signature/vérification
 *     passe explicitement le secret (access ou refresh) via TokenService.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AuthSessionEntity]),
    JwtModule.register({}),
    UsersModule,
    AuditModule,
  ],
  controllers: [AuthenticationController],
  providers: [
    TokenService,
    RefreshCookieService,
    AuthSessionMapper,
    LoginUseCase,
    RefreshTokensUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    ListSessionsUseCase,
    RevokeSessionUseCase,
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    {
      provide: IDENTITY_PROVIDER,
      useClass: LocalIdentityProvider,
    },
    {
      provide: AUTH_SESSION_REPOSITORY,
      useClass: TypeOrmAuthSessionRepository,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // IMPORTANT : après JwtAuthGuard — RolesGuard lit request.user que
    // le guard JWT vient de poser.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AUTH_SESSION_REPOSITORY, TokenService],
})
export class AuthenticationModule {}
