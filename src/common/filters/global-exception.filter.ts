import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { EntityNotFoundError, QueryFailedError, TypeORMError } from 'typeorm';
import { AppException, ErrorDetail } from '../exceptions/app.exception';
import { ErrorCode } from '../exceptions/error-code.enum';
import { resolveRequestId } from '../utils/request-id.util';

/** Corps d'erreur standardisé renvoyé par l'API. */
interface ErrorResponseBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
  meta: {
    requestId: string;
    timestamp: string;
    path: string;
  };
}

/**
 * Filtre global de conversion des exceptions en réponses standardisées.
 *
 * Garanties :
 *   - les exceptions applicatives (AppException) conservent leur code
 *     technique stable et leur message français ;
 *   - les erreurs TypeORM sont converties sans JAMAIS divulguer le SQL,
 *     les noms de tables ou la stack trace au consommateur ;
 *   - toute erreur inconnue devient un INTERNAL_SERVER_ERROR générique ;
 *   - chaque erreur est journalisée avec le request ID pour le diagnostic ;
 *   - la stack trace n'apparaît dans les logs détaillés qu'en local
 *     (elle n'est jamais renvoyée au client, quel que soit l'environnement).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly isLocalEnvironment: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const { status, code, message, details } = this.mapException(exception);

    const body: ErrorResponseBody = {
      success: false,
      error: {
        code,
        message,
        ...(details && details.length > 0 ? { details } : {}),
      },
      meta: {
        requestId: resolveRequestId(request),
        timestamp: new Date().toISOString(),
        path: request.originalUrl ?? request.url,
      },
    };

    this.logException(exception, body, status);

    response.status(status).json(body);
  }

  /** Traduit chaque famille d'exceptions vers le format standard. */
  private mapException(exception: unknown): {
    status: number;
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  } {
    // Exceptions applicatives : déjà porteuses du contrat complet.
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    // Erreurs TypeORM : converties en DATABASE_ERROR générique
    // (le détail part dans les logs, jamais chez le client).
    if (
      exception instanceof QueryFailedError ||
      exception instanceof EntityNotFoundError ||
      exception instanceof TypeORMError
    ) {
      if (exception instanceof EntityNotFoundError) {
        return {
          status: HttpStatus.NOT_FOUND,
          code: ErrorCode.ResourceNotFound,
          message: 'La ressource demandée est introuvable.',
        };
      }
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.DatabaseError,
        message: 'Une erreur est survenue lors de l’accès aux données.',
      };
    }

    // Exceptions HTTP NestJS (404 de route inconnue, 429 du rate
    // limiting, guards...) : statut conservé, code technique déduit.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: this.httpStatusToErrorCode(status),
        message: this.httpStatusToFrenchMessage(status, exception.message),
      };
    }

    // Erreur totalement inconnue : réponse générique.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.InternalServerError,
      message: 'Une erreur interne est survenue.',
    };
  }

  /** Correspondance statut HTTP -> code technique stable. */
  private static readonly STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> =
    {
      [HttpStatus.BAD_REQUEST]: ErrorCode.ValidationError,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.AccessTokenInvalid,
      [HttpStatus.NOT_FOUND]: ErrorCode.ResourceNotFound,
      [HttpStatus.CONFLICT]: ErrorCode.ResourceAlreadyExists,
      [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.FileTooLarge,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TooManyRequests,
    };

  /** Correspondance statut HTTP -> message français générique. */
  private static readonly STATUS_TO_MESSAGE: Readonly<Record<number, string>> =
    {
      [HttpStatus.BAD_REQUEST]: 'Les données transmises sont invalides.',
      [HttpStatus.UNAUTHORIZED]: 'Authentification requise.',
      [HttpStatus.FORBIDDEN]: 'Accès refusé.',
      [HttpStatus.NOT_FOUND]: 'La ressource demandée est introuvable.',
      [HttpStatus.TOO_MANY_REQUESTS]:
        'Trop de requêtes, veuillez réessayer plus tard.',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Une erreur interne est survenue.',
    };

  private httpStatusToErrorCode(status: number): ErrorCode {
    return (
      GlobalExceptionFilter.STATUS_TO_CODE[status] ??
      ErrorCode.InternalServerError
    );
  }

  private httpStatusToFrenchMessage(status: number, fallback: string): string {
    return GlobalExceptionFilter.STATUS_TO_MESSAGE[status] ?? fallback;
  }

  /**
   * Journalise l'erreur avec le request ID.
   * Les 4xx attendus sont en niveau warn, les 5xx en error avec la
   * stack complète (utile au diagnostic ; visible en local uniquement
   * si le niveau de log le permet).
   */
  private logException(
    exception: unknown,
    body: ErrorResponseBody,
    status: number,
  ): void {
    const summary =
      `${body.error.code} ${status} ${body.meta.path} ` +
      `requestId=${body.meta.requestId}`;

    if (status >= 500) {
      const stack =
        this.isLocalEnvironment && exception instanceof Error
          ? exception.stack
          : undefined;
      this.logger.error(
        `${summary} — ${this.describeInternalError(exception)}`,
        stack,
      );
    } else {
      this.logger.warn(summary);
    }
  }

  /** Description interne (logs uniquement, jamais renvoyée au client). */
  private describeInternalError(exception: unknown): string {
    if (exception instanceof Error) {
      return `${exception.name}: ${exception.message}`;
    }
    return String(exception);
  }
}
