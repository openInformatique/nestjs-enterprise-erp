import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { observabilityConfig } from '../../../config/observability.config';
import { CheckOverdueInvoicesUseCase } from './check-overdue-invoices.use-case';

/**
 * Tâche planifiée : détection des factures en retard.
 * Quotidienne à 02:00 (une heure après l'expiration des devis) —
 * même pattern que les tâches des modules 00 et 05 : interrupteur
 * SCHEDULER_ENABLED, verrou anti-chevauchement, erreurs capturées.
 */
@Injectable()
export class CheckOverdueInvoicesTask {
  private readonly logger = new Logger(CheckOverdueInvoicesTask.name);
  private running = false;

  constructor(
    private readonly checkOverdueInvoicesUseCase: CheckOverdueInvoicesUseCase,
    @Inject(observabilityConfig.KEY)
    private readonly config: ConfigType<typeof observabilityConfig>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron(): Promise<void> {
    if (!this.config.schedulerEnabled) {
      return;
    }
    await this.execute();
  }

  /** Marque les retards ; renvoie le nombre de factures traitées. */
  async execute(): Promise<number> {
    if (this.running) {
      this.logger.warn(
        'Détection des retards ignorée : une exécution est déjà en cours.',
      );
      return 0;
    }

    this.running = true;
    const startedAt = Date.now();

    try {
      const count = await this.checkOverdueInvoicesUseCase.execute();
      this.logger.log(
        `Détection des retards : terminée en ${Date.now() - startedAt} ms, ` +
          `${count} facture(s) passée(s) en OVERDUE.`,
      );
      return count;
    } catch (error) {
      this.logger.error(
        `Détection des retards : échec — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
