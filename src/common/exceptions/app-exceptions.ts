import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorDetail } from './app.exception';
import { ErrorCode } from './error-code.enum';

/**
 * Exceptions applicatives concrètes du socle.
 *
 * Chaque classe fige un code technique stable, un statut HTTP et un
 * message français par défaut (surchargeables lorsque pertinent).
 */

/** Données d'entrée invalides (DTO, paramètres, query string). */
export class ValidationException extends AppException {
  constructor(details: ErrorDetail[]) {
    super(
      ErrorCode.ValidationError,
      'Les données transmises sont invalides.',
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

/**
 * Identifiants incorrects ou compte inutilisable.
 * Message volontairement générique : ne révèle pas si l'e-mail existe.
 */
export class AuthenticationFailedException extends AppException {
  constructor() {
    super(
      ErrorCode.AuthenticationFailed,
      'Identifiants incorrects.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AccessTokenInvalidException extends AppException {
  constructor() {
    super(
      ErrorCode.AccessTokenInvalid,
      "Le jeton d'accès est invalide ou expiré.",
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class RefreshTokenInvalidException extends AppException {
  constructor() {
    super(
      ErrorCode.RefreshTokenInvalid,
      'Le jeton de rafraîchissement est invalide.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class SessionExpiredException extends AppException {
  constructor() {
    super(
      ErrorCode.SessionExpired,
      'La session a expiré, veuillez vous reconnecter.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class SessionRevokedException extends AppException {
  constructor() {
    super(
      ErrorCode.SessionRevoked,
      'La session a été révoquée, veuillez vous reconnecter.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Réutilisation d'un ancien refresh token après rotation : la famille de
 * tokens est considérée compromise et intégralement révoquée.
 */
export class RefreshTokenReuseDetectedException extends AppException {
  constructor() {
    super(
      ErrorCode.RefreshTokenReuseDetected,
      'Réutilisation d’un jeton de rafraîchissement détectée. ' +
        'Toutes les sessions associées ont été révoquées par sécurité.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class ResourceNotFoundException extends AppException {
  constructor(resourceLabel = 'La ressource demandée') {
    super(
      ErrorCode.ResourceNotFound,
      `${resourceLabel} est introuvable.`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ResourceAlreadyExistsException extends AppException {
  constructor(message = 'Une ressource identique existe déjà.') {
    super(ErrorCode.ResourceAlreadyExists, message, HttpStatus.CONFLICT);
  }
}

/**
 * Erreur base de données : le message reste générique, les détails SQL
 * ne sont JAMAIS exposés au consommateur (ils partent dans les logs).
 */
export class DatabaseException extends AppException {
  constructor() {
    super(
      ErrorCode.DatabaseError,
      'Une erreur est survenue lors de l’accès aux données.',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class FileNotFoundException extends AppException {
  constructor() {
    super(
      ErrorCode.FileNotFound,
      'Le fichier demandé est introuvable.',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class FileTypeNotAllowedException extends AppException {
  constructor(allowedMimeTypes: readonly string[]) {
    super(
      ErrorCode.FileTypeNotAllowed,
      `Ce type de fichier n'est pas autorisé. Types acceptés : ` +
        `${allowedMimeTypes.join(', ')}.`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class FileTooLargeException extends AppException {
  constructor(maxFileSizeBytes: number) {
    super(
      ErrorCode.FileTooLarge,
      `Le fichier dépasse la taille maximale autorisée ` +
        `(${Math.floor(maxFileSizeBytes / 1024 / 1024)} Mo).`,
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}

/**
 * Utilisateur authentifié mais dont le rôle ne permet pas l'action.
 * À distinguer du 401 (non authentifié) : ici l'identité est connue,
 * c'est l'autorisation qui manque. Levée principalement par RolesGuard.
 */
export class AccessDeniedException extends AppException {
  constructor(
    message = "Vous n'avez pas les droits nécessaires pour effectuer cette action.",
  ) {
    super(ErrorCode.AccessDenied, message, HttpStatus.FORBIDDEN);
  }
}

/**
 * Règle métier violée : la requête est bien formée mais l'état actuel
 * des données interdit l'opération. Le message dit PRÉCISÉMENT quelle
 * règle bloque.
 */
export class BusinessRuleViolationException extends AppException {
  constructor(message: string) {
    super(ErrorCode.BusinessRuleViolation, message, HttpStatus.CONFLICT);
  }
}

/**
 * L'export dépasse le plafond de lignes (10 000). 422 : la requête est
 * bien formée, mais le VOLUME de données qu'elle désigne est trop
 * grand pour être traité — distinct d'une erreur de validation (400)
 * ou d'une règle métier violée (409).
 */
export class ExportTooLargeException extends AppException {
  constructor(actualCount: number, maxRows: number) {
    super(
      ErrorCode.ExportTooLarge,
      `L'export contient ${actualCount} lignes, au-delà du plafond de ` +
        `${maxRows}. Affinez les filtres pour réduire le volume.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
