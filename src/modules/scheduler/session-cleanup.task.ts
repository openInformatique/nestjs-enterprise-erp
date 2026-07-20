import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { observabilityConfig } from '../../config/observability.config';
import { AUTH_SESSION_REPOSITORY } from '../authentication/domain/auth-session-repository.port';
import type { AuthSessionRepositoryPort } from '../authentication/domain/auth-session-repository.port';

/**
 * Durée de rétention des sessions expirées avant suppression physique.
 *
 * Une session expirée reste inutilisable immédiatement ; la conserver
 * quelques jours permet le diagnostic (détection de réutilisation,
 * investigation de sécurité) avant purge définitive.
 */
const EXPIRED_SESSION_RETENTION_DAYS = 7;

/**
 * Tâche planifiée : purge des sessions expirées.
 *
 * - exécution horaire ;
 * - désactivable globalement via SCHEDULER_ENABLED=false ;
 * - idempotente : supprimer zéro ligne est un résultat normal ;
 * - verrou local (`running`) : jamais deux exécutions concurrentes dans
 *   un même processus. LIMITE DOCUMENTÉE : ce verrou ne protège pas un
 *   déploiement multi-instances ; il faudrait alors un verrou partagé
 *   (table SQL dédiée ou sp_getapplock) — voir docs/scheduled-tasks.md ;
 * - journalise début, fin, durée et nombre de lignes supprimées ;
 * - les erreurs sont capturées et journalisées : un échec de purge ne
 *   doit jamais faire tomber le processus.
 *
 * La méthode execute() est publique : les tests l'appellent directement
 * sans attendre le déclenchement du cron.
 */
@Injectable()
export class SessionCleanupTask {
  private readonly logger = new Logger(SessionCleanupTask.name);
  private running = false;

  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepository: AuthSessionRepositoryPort,
    @Inject(observabilityConfig.KEY)
    private readonly config: ConfigType<typeof observabilityConfig>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    if (!this.config.schedulerEnabled) {
      return;
    }
    await this.execute();
  }

  /** Purge les sessions expirées ; renvoie le nombre de lignes supprimées. */
  async execute(): Promise<number> {
    if (this.running) {
      this.logger.warn(
        'Purge des sessions ignorée : une exécution est déjà en cours.',
      );
      return 0;
    }

    this.running = true;
    const startedAt = Date.now();
    this.logger.log('Purge des sessions expirées : début.');

    try {
      const threshold = new Date(
        Date.now() - EXPIRED_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      const deletedCount =
        await this.sessionRepository.deleteExpiredBefore(threshold);

      this.logger.log(
        `Purge des sessions expirées : terminée en ` +
          `${Date.now() - startedAt} ms, ${deletedCount} session(s) supprimée(s).`,
      );
      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Purge des sessions expirées : échec après ` +
          `${Date.now() - startedAt} ms — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
