import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestContextData } from './request-context';

/**
 * Contexte de requête basé sur AsyncLocalStorage.
 *
 * Permet à n'importe quel service (audit, logs...) d'accéder aux
 * informations de la requête courante sans avoir à les propager
 * explicitement dans toutes les signatures.
 *
 * Règles d'utilisation :
 *   - le middleware ouvre le contexte au tout début de la requête ;
 *   - `get()` renvoie undefined hors requête HTTP (tâche planifiée,
 *     script CLI) : les consommateurs doivent gérer ce cas ;
 *   - l'enrichissement (userId, sessionId) se fait via `update()`.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextData>();

  /** Exécute `callback` dans un nouveau contexte de requête. */
  run<T>(data: RequestContextData, callback: () => T): T {
    return this.storage.run(data, callback);
  }

  /** Contexte courant, ou undefined hors requête HTTP. */
  get(): RequestContextData | undefined {
    return this.storage.getStore();
  }

  /** Identifiant de la requête courante, si disponible. */
  getRequestId(): string | undefined {
    return this.get()?.requestId;
  }

  /**
   * Enrichit le contexte courant (ex. : userId une fois le JWT validé).
   * Sans effet si aucun contexte n'est ouvert.
   */
  update(partial: Partial<Omit<RequestContextData, 'requestId'>>): void {
    const current = this.get();
    if (current) {
      Object.assign(current, partial);
    }
  }
}
