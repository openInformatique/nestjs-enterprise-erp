import { Inject, Injectable } from '@nestjs/common';
import { AuthSession } from '../domain/auth-session';
import { AUTH_SESSION_REPOSITORY } from '../domain/auth-session-repository.port';
import type { AuthSessionRepositoryPort } from '../domain/auth-session-repository.port';

/**
 * Cas d'utilisation : lister les sessions actives de l'utilisateur
 * connecté (et uniquement les siennes, règle du socle).
 */
@Injectable()
export class ListSessionsUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepository: AuthSessionRepositoryPort,
  ) {}

  async execute(userId: string): Promise<AuthSession[]> {
    return this.sessionRepository.findActiveByUserId(userId);
  }
}
