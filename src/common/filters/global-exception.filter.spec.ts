import { ArgumentsHost, HttpStatus, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  AuthenticationFailedException,
  ValidationException,
} from '../exceptions/app-exceptions';
import { ErrorCode } from '../exceptions/error-code.enum';
import { GlobalExceptionFilter } from './global-exception.filter';

/** Construit un ArgumentsHost factice avec requête et réponse espionnées. */
const createHost = (): {
  host: ArgumentsHost;
  getStatus: () => number | undefined;
  getBody: () => Record<string, unknown> | undefined;
} => {
  let statusCode: number | undefined;
  let body: Record<string, unknown> | undefined;

  const request = {
    originalUrl: '/api/v1/auth/login',
    url: '/api/v1/auth/login',
    get: () => undefined,
  };
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: Record<string, unknown>) {
      body = payload;
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    getStatus: () => statusCode,
    getBody: () => body,
  };
};

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter(false);
  });

  it('convertit une AppException en réponse standardisée', () => {
    const { host, getStatus, getBody } = createHost();

    filter.catch(new AuthenticationFailedException(), host);

    expect(getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    const body = getBody()!;
    expect(body.success).toBe(false);
    expect(body.error).toMatchObject({
      code: ErrorCode.AuthenticationFailed,
      message: 'Identifiants incorrects.',
    });
    const meta = body.meta as Record<string, unknown>;
    expect(meta.requestId).toBeDefined();
    expect(meta.timestamp).toBeDefined();
    expect(meta.path).toBe('/api/v1/auth/login');
  });

  it('inclut les détails des erreurs de validation', () => {
    const { host, getBody } = createHost();

    filter.catch(
      new ValidationException([
        { field: 'email', message: 'L’adresse e-mail n’est pas valide.' },
      ]),
      host,
    );

    const error = getBody()!.error as Record<string, unknown>;
    expect(error.code).toBe(ErrorCode.ValidationError);
    expect(error.details).toEqual([
      { field: 'email', message: 'L’adresse e-mail n’est pas valide.' },
    ]);
  });

  it('convertit une erreur TypeORM sans divulguer le SQL', () => {
    const { host, getStatus, getBody } = createHost();
    const sqlError = new QueryFailedError(
      'SELECT secret FROM users WHERE password_hash = ...',
      [],
      new Error('Violation of UNIQUE KEY constraint UQ_users_email'),
    );

    filter.catch(sqlError, host);

    expect(getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = getBody()!;
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe(ErrorCode.DatabaseError);
    // Le message ne doit contenir ni SQL ni détail de contrainte.
    expect(JSON.stringify(body)).not.toContain('SELECT');
    expect(JSON.stringify(body)).not.toContain('UNIQUE KEY');
  });

  it('convertit une HttpException NestJS standard', () => {
    const { host, getStatus, getBody } = createHost();

    filter.catch(new NotFoundException(), host);

    expect(getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect((getBody()!.error as Record<string, unknown>).code).toBe(
      ErrorCode.ResourceNotFound,
    );
  });

  it('convertit une erreur inconnue en INTERNAL_SERVER_ERROR générique', () => {
    const { host, getStatus, getBody } = createHost();

    filter.catch(new Error('détail interne ultra sensible'), host);

    expect(getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = getBody()!;
    expect((body.error as Record<string, unknown>).code).toBe(
      ErrorCode.InternalServerError,
    );
    // Le détail interne ne doit jamais atteindre le client.
    expect(JSON.stringify(body)).not.toContain('ultra sensible');
    expect(JSON.stringify(body)).not.toContain('stack');
  });
});
