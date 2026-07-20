/**
 * Codes d'erreur techniques stables exposés par l'API.
 *
 * Ces codes constituent un contrat : les consommateurs peuvent s'appuyer
 * dessus pour leur logique (contrairement aux messages, destinés aux
 * humains et susceptibles d'évoluer).
 */
export enum ErrorCode {
  ValidationError = 'VALIDATION_ERROR',
  AuthenticationFailed = 'AUTHENTICATION_FAILED',
  AccessTokenInvalid = 'ACCESS_TOKEN_INVALID',
  RefreshTokenInvalid = 'REFRESH_TOKEN_INVALID',
  SessionExpired = 'SESSION_EXPIRED',
  SessionRevoked = 'SESSION_REVOKED',
  RefreshTokenReuseDetected = 'REFRESH_TOKEN_REUSE_DETECTED',
  ResourceNotFound = 'RESOURCE_NOT_FOUND',
  ResourceAlreadyExists = 'RESOURCE_ALREADY_EXISTS',
  DatabaseError = 'DATABASE_ERROR',
  FileNotFound = 'FILE_NOT_FOUND',
  FileTypeNotAllowed = 'FILE_TYPE_NOT_ALLOWED',
  FileTooLarge = 'FILE_TOO_LARGE',
  TooManyRequests = 'TOO_MANY_REQUESTS',
  InternalServerError = 'INTERNAL_SERVER_ERROR',
  AccessDenied = 'ACCESS_DENIED',
  BusinessRuleViolation = 'BUSINESS_RULE_VIOLATION',
  ExportTooLarge = 'EXPORT_TOO_LARGE',
}
