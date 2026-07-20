import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('expose le contexte à l’intérieur de run()', () => {
    service.run({ requestId: 'req-1', startedAt: new Date() }, () => {
      expect(service.getRequestId()).toBe('req-1');
      expect(service.get()?.startedAt).toBeInstanceOf(Date);
    });
  });

  it('renvoie undefined hors de tout contexte (script, cron)', () => {
    expect(service.get()).toBeUndefined();
    expect(service.getRequestId()).toBeUndefined();
  });

  it('isole les contextes concurrents', async () => {
    const results = await Promise.all([
      new Promise<string | undefined>((resolve) => {
        service.run({ requestId: 'req-A', startedAt: new Date() }, () => {
          setTimeout(() => resolve(service.getRequestId()), 10);
        });
      }),
      new Promise<string | undefined>((resolve) => {
        service.run({ requestId: 'req-B', startedAt: new Date() }, () => {
          setTimeout(() => resolve(service.getRequestId()), 5);
        });
      }),
    ]);

    expect(results).toEqual(['req-A', 'req-B']);
  });

  it('enrichit le contexte courant avec update()', () => {
    service.run({ requestId: 'req-1', startedAt: new Date() }, () => {
      service.update({ userId: 'user-42', sessionId: 'session-7' });

      expect(service.get()).toMatchObject({
        requestId: 'req-1',
        userId: 'user-42',
        sessionId: 'session-7',
      });
    });
  });

  it('update() est sans effet hors contexte', () => {
    expect(() => service.update({ userId: 'user-42' })).not.toThrow();
    expect(service.get()).toBeUndefined();
  });
});
