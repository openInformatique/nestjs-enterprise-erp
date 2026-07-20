import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { PaginationMetaDto } from '../pagination/pagination-meta.dto';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

const createContext = (options: {
  skipEnvelope?: boolean;
  statusCode?: number;
  headersSent?: boolean;
}): ExecutionContext => {
  const request = {
    get: () => undefined,
  };
  const response = {
    statusCode: options.statusCode ?? 200,
    headersSent: options.headersSent ?? false,
  };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
};

const createReflector = (skipEnvelope: boolean): Reflector =>
  ({
    getAllAndOverride: () => skipEnvelope,
  }) as unknown as Reflector;

const createHandler = (payload: unknown): CallHandler => ({
  handle: () => of(payload),
});

describe('ResponseEnvelopeInterceptor', () => {
  it('enveloppe une réponse simple', async () => {
    const interceptor = new ResponseEnvelopeInterceptor(createReflector(false));

    const result = (await lastValueFrom(
      interceptor.intercept(createContext({}), createHandler({ id: '42' })),
    )) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: '42' });
    const meta = result.meta as Record<string, unknown>;
    expect(typeof meta.requestId).toBe('string');
    expect(typeof meta.timestamp).toBe('string');
    expect(meta.pagination).toBeUndefined();
  });

  it('déplace la pagination dans meta.pagination', async () => {
    const interceptor = new ResponseEnvelopeInterceptor(createReflector(false));
    const paginated = {
      items: [{ id: '1' }],
      meta: PaginationMetaDto.fromTotals(1, 20, 48),
    };

    const result = (await lastValueFrom(
      interceptor.intercept(createContext({}), createHandler(paginated)),
    )) as Record<string, unknown>;

    expect(result.data).toEqual([{ id: '1' }]);
    const meta = result.meta as Record<string, unknown>;
    expect(meta.pagination).toMatchObject({
      page: 1,
      limit: 20,
      totalItems: 48,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('convertit un retour vide en data: null', async () => {
    const interceptor = new ResponseEnvelopeInterceptor(createReflector(false));

    const result = (await lastValueFrom(
      interceptor.intercept(createContext({}), createHandler(undefined)),
    )) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('respecte @SkipResponseEnvelope()', async () => {
    const interceptor = new ResponseEnvelopeInterceptor(createReflector(true));
    const rawPayload = 'contenu brut';

    const result = await lastValueFrom(
      interceptor.intercept(createContext({}), createHandler(rawPayload)),
    );

    expect(result).toBe(rawPayload);
  });

  it("n'enveloppe pas un StreamableFile", async () => {
    const interceptor = new ResponseEnvelopeInterceptor(createReflector(false));
    const file = new StreamableFile(Buffer.from('PDF'));

    const result = await lastValueFrom(
      interceptor.intercept(createContext({}), createHandler(file)),
    );

    expect(result).toBe(file);
  });

  it("n'enveloppe pas un Buffer", async () => {
    const interceptor = new ResponseEnvelopeInterceptor(createReflector(false));
    const buffer = Buffer.from('binaire');

    const result = await lastValueFrom(
      interceptor.intercept(createContext({}), createHandler(buffer)),
    );

    expect(result).toBe(buffer);
  });

  it("n'enveloppe pas une réponse 204", async () => {
    const interceptor = new ResponseEnvelopeInterceptor(createReflector(false));

    const result = await lastValueFrom(
      interceptor.intercept(
        createContext({ statusCode: 204 }),
        createHandler(undefined),
      ),
    );

    expect(result).toBeUndefined();
  });
});
