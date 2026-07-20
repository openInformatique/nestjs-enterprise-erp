import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { observabilityConfig } from '../../../config/observability.config';
import { ExpireQuotesUseCase } from './expire-quotes.use-case';

/**
 * Tâche planifiée : expiration des devis dépassés.
 *
 * - exécution quotidienne à 01:00 ;
 * - désactivable via SCHEDULER_ENABLED=false (comme toutes les tâches) ;
 * - verrou local anti-chevauchement (mono-instance, cf. socle) ;
 * - un échec est journalisé, jamais propagé : le cron ne doit pas
 *   faire tomber le processus.
 *
 * execute() est publique : appelable directement (tests, rattrapage
 * manuel) sans attendre 01:00.
 */
@Injectable()
export class ExpireQuotesTask {
  private readonly logger = new Logger(ExpireQuotesTask.name);
  private running = false;

  constructor(
    private readonly expireQuotesUseCase: ExpireQuotesUseCase,
    @Inject(observabilityConfig.KEY)
    private readonly config: ConfigType<typeof observabilityConfig>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron(): Promise<void> {
    if (!this.config.schedulerEnabled) {
      return;
    }
    await this.execute();
  }

  /** Fait expirer les devis dépassés ; renvoie le nombre traité. */
  async execute(): Promise<number> {
    if (this.running) {
      this.logger.warn(
        'Expiration des devis ignorée : une exécution est déjà en cours.',
      );
      return 0;
    }

    this.running = true;
    const startedAt = Date.now();

    try {
      const count = await this.expireQuotesUseCase.execute();
      this.logger.log(
        `Expiration des devis : terminée en ${Date.now() - startedAt} ms, ` +
          `${count} devis expiré(s).`,
      );
      return count;
    } catch (error) {
      this.logger.error(
        `Expiration des devis : échec — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
