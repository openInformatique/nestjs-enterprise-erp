import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { User } from '../domain/user';
import { USER_REPOSITORY } from '../domain/user-repository.port';
import type {
  ListUsersQuery,
  UserRepositoryPort,
} from '../domain/user-repository.port';

/**
 * Cas d'utilisation : lister les utilisateurs (pagination + filtres).
 *
 * Volontairement mince : la construction de la requête SQL appartient au
 * repository. Le use case reste néanmoins le point d'entrée unique de la
 * couche présentation — si une règle métier apparaît demain, elle se
 * logera ici sans toucher au contrôleur.
 */
@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  execute(query: ListUsersQuery): Promise<PaginatedResult<User>> {
    return this.userRepository.findAll(query);
  }
}
