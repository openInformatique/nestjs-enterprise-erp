import { HttpException } from '@nestjs/common';
import { ErrorCode } from './error-code.enum';

/** Détail d'erreur associé à un champ précis (validation). */
export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Exception applicative de base du socle.
 *
 * Toutes les erreurs volontairement levées par le code applicatif passent
 * par cette hiérarchie : le filtre global sait alors produire l'enveloppe
 * d'erreur standardisée sans divulguer de détail technique.
 *
 * Le message est destiné aux consommateurs de l'API : il est rédigé en
 * français et ne contient jamais d'information sensible.
 */
export abstract class AppException extends HttpException {
  constructor(
    /** Code technique stable (contrat d'API). */
    public readonly code: ErrorCode,
    /** Message français destiné au consommateur. */
    message: string,
    httpStatus: number,
    /** Détails par champ, principalement pour les erreurs de validation. */
    public readonly details?: ErrorDetail[],
  ) {
    super(message, httpStatus);
  }
}
