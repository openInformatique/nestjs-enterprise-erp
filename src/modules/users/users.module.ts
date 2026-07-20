import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PASSWORD_HASHER } from '../authentication/domain/password-hasher.port';
import { Argon2PasswordHasher } from '../authentication/infrastructure/argon2-password-hasher';
import { ChangeMyPasswordUseCase } from './application/change-my-password.use-case';
import { ChangeUserRoleUseCase } from './application/change-user-role.use-case';
import { CreateUserUseCase } from './application/create-user.use-case';
import { DeactivateUserUseCase } from './application/deactivate-user.use-case';
import { GetUserByIdUseCase } from './application/get-user-by-id.use-case';
import { ListUsersUseCase } from './application/list-users.use-case';
import { ReactivateUserUseCase } from './application/reactivate-user.use-case';
import { USER_REPOSITORY } from './domain/user-repository.port';
import { UserEntity } from './infrastructure/entities/user.entity';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository';
import { UserMapper } from './infrastructure/user.mapper';
import { UsersController } from './presentation/users.controller';

/**
 * Module des utilisateurs techniques.
 *
 * Expose le CRUD d'administration des comptes (rôles ADMIN/MANAGER via
 * RolesGuard) et le self-service GET /users/me.
 *
 * Le binding PASSWORD_HASHER est déclaré ICI aussi (et pas importé
 * d'AuthenticationModule) : AuthenticationModule importe déjà UsersModule,
 * l'inverse créerait une dépendance circulaire.
 *
 * Le repository (port USER_REPOSITORY) et GetUserByIdUseCase restent
 * exportés pour le module d'authentification (et pour RolesGuard).
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [
    UserMapper,
    GetUserByIdUseCase,
    ListUsersUseCase,
    CreateUserUseCase,
    ChangeUserRoleUseCase,
    ChangeMyPasswordUseCase,
    DeactivateUserUseCase,
    ReactivateUserUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
  ],
  exports: [USER_REPOSITORY, GetUserByIdUseCase],
})
export class UsersModule {}
