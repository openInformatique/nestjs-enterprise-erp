import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import { PaginatedResult } from '../pagination/paginated-result';
import { PaginationMetaDto } from '../pagination/pagination-meta.dto';
import { SKIP_RESPONSE_ENVELOPE_KEY } from '../decorators/skip-response-envelope.decorator';
import { resolveRequestId } from '../utils/request-id.util';

/** Enveloppe standard d'une réponse réussie. */
interface SuccessEnvelope {
  success: true;
  data: unknown;
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: PaginationMetaDto;
  };
}

/**
 * Interceptor global d'uniformisation des réponses JSON.
 *
 * Réponse simple  : { success, data, meta: { requestId, timestamp } }
 * Réponse paginée : détectée via PaginatedResult (items + meta), la
 *                   pagination est déplacée dans meta.pagination.
 *
 * Ne sont PAS enveloppés :
 *   - les endpoints décorés @SkipResponseEnvelope() (fichiers, métriques...) ;
 *   - les StreamableFile et Buffer (téléchargements, flux) ;
 *   - les réponses 204 No Content (aucun corps attendu) ;
 *   - les cas où la réponse a déjà été envoyée manuellement (res.send).
 *
 * Swagger n'est pas concerné : il est servi en dehors des routes NestJS.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipEnvelope) {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    return next.handle().pipe(
      map((payload: unknown) => {
        // Réponses sans corps (204) ou binaires : intactes.
        if (response.statusCode === 204) {
          return payload;
        }
        if (payload instanceof StreamableFile || Buffer.isBuffer(payload)) {
          return payload;
        }
        // Réponse déjà émise manuellement : ne rien réécrire.
        if (response.headersSent) {
          return payload;
        }

        return this.buildEnvelope(payload, request);
      }),
    );
  }

  private buildEnvelope(payload: unknown, request: Request): SuccessEnvelope {
    const baseMeta = {
      requestId: resolveRequestId(request),
      timestamp: new Date().toISOString(),
    };

    if (this.isPaginatedResult(payload)) {
      return {
        success: true,
        data: payload.items,
        meta: { ...baseMeta, pagination: payload.meta },
      };
    }

    return {
      success: true,
      // Un handler sans retour produit data: null (jamais undefined,
      // qui disparaîtrait de la sérialisation JSON).
      data: payload ?? null,
      meta: baseMeta,
    };
  }

  /** Détecte la forme PaginatedResult { items: [], meta: PaginationMeta }. */
  private isPaginatedResult(
    payload: unknown,
  ): payload is PaginatedResult<unknown> {
    if (payload === null || typeof payload !== 'object') {
      return false;
    }
    const candidate = payload as Partial<PaginatedResult<unknown>>;
    return (
      Array.isArray(candidate.items) &&
      candidate.meta !== undefined &&
      typeof candidate.meta === 'object' &&
      typeof candidate.meta.page === 'number' &&
      typeof candidate.meta.totalItems === 'number'
    );
  }
}
