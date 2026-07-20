import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthenticationModule } from '../authentication/authentication.module';
import { SessionCleanupTask } from './session-cleanup.task';

/**
 * Module des tâches planifiées.
 *
 * L'infrastructure cron est toujours enregistrée ; chaque tâche vérifie
 * SCHEDULER_ENABLED à l'exécution (activation/désactivation sans
 * recompilation ni conditionnel d'import).
 */
@Module({
  imports: [ScheduleModule.forRoot(), AuthenticationModule],
  providers: [SessionCleanupTask],
})
export class SchedulerModule {}
