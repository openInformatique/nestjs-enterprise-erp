import { Injectable } from '@nestjs/common';
import { User } from '../domain/user';
import { UserEntity } from './entities/user.entity';

/**
 * Conversion entité TypeORM <-> modèle de domaine.
 * Le domaine ne voit jamais l'entité TypeORM.
 */
@Injectable()
export class UserMapper {
  toDomain(entity: UserEntity): User {
    return new User(
      entity.id,
      entity.email,
      entity.displayName,
      entity.passwordHash,
      entity.authenticationSource,
      entity.role,
      entity.isActive,
      entity.lastLoginAt,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
