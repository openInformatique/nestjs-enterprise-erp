import { AuthSessionRepositoryPort } from '../authentication/domain/auth-session-repository.port';
import { SessionCleanupTask } from './session-cleanup.task';

const buildTask = (
  deleteImplementation: (threshold: Date) => Promise<number>,
  schedulerEnabled = true,
): SessionCleanupTask => {
  const repository = {
    deleteExpiredBefore: deleteImplementation,
  } as unknown as AuthSessionRepositoryPort;
  return new SessionCleanupTask(repository, {
    metricsEnabled: false,
    schedulerEnabled,
  });
};

describe('SessionCleanupTask', () => {
  it('supprime les sessions expirées avec un seuil de rétention de 7 jours', async () => {
    let receivedThreshold: Date | undefined;
    const task = buildTask((threshold) => {
      receivedThreshold = threshold;
      return Promise.resolve(3);
    });

    const deleted = await task.execute();

    expect(deleted).toBe(3);
    const expectedThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(receivedThreshold!.getTime()).toBeGreaterThan(
      expectedThreshold - 5000,
    );
    expect(receivedThreshold!.getTime()).toBeLessThanOrEqual(
      expectedThreshold + 5000,
    );
  });

  it('est idempotente : zéro suppression est un résultat normal', async () => {
    const task = buildTask(() => Promise.resolve(0));

    await expect(task.execute()).resolves.toBe(0);
    await expect(task.execute()).resolves.toBe(0);
  });

  it('empêche les exécutions concurrentes dans le même processus', async () => {
    let resolveFirst: ((count: number) => void) | undefined;
    let callCount = 0;
    const task = buildTask(() => {
      callCount += 1;
      return new Promise((resolve) => {
        resolveFirst = resolve;
      });
    });

    const first = task.execute();
    // Seconde exécution pendant que la première est en cours : ignorée.
    const second = await task.execute();
    expect(second).toBe(0);
    expect(callCount).toBe(1);

    resolveFirst!(5);
    await expect(first).resolves.toBe(5);

    // Une fois la première terminée, une nouvelle exécution repart.
    const third = task.execute();
    expect(callCount).toBe(2);
    resolveFirst!(1);
    await third;
  });

  it('capture les erreurs sans les propager', async () => {
    const task = buildTask(() =>
      Promise.reject(new Error('base indisponible')),
    );

    await expect(task.execute()).resolves.toBe(0);
    // Le verrou est bien relâché après un échec.
    await expect(task.execute()).resolves.toBe(0);
  });

  it('ne fait rien via le cron lorsque SCHEDULER_ENABLED=false', async () => {
    let called = false;
    const task = buildTask(() => {
      called = true;
      return Promise.resolve(0);
    }, false);

    await task.handleCron();

    expect(called).toBe(false);
  });
});
