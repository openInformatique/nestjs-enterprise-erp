import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ErrorDetail } from '../exceptions/app.exception';
import { ValidationException } from '../exceptions/app-exceptions';

/**
 * Aplatit récursivement les erreurs class-validator en détails
 * champ / message, y compris pour les objets imbriqués
 * (le chemin devient "parent.enfant").
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ErrorDetail[] {
  const details: ErrorDetail[] = [];

  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        details.push({ field: path, message });
      }
    }

    if (error.children && error.children.length > 0) {
      details.push(...flattenValidationErrors(error.children, path));
    }
  }

  return details;
}

/**
 * Construit le ValidationPipe global du socle.
 *
 * - whitelist + forbidNonWhitelisted : toute propriété non déclarée dans
 *   le DTO est rejetée (aucune donnée inattendue ne traverse l'API) ;
 * - transform : les payloads deviennent des instances de DTO typées
 *   (les @Type/@Transform des DTO s'appliquent) ;
 * - les erreurs sont converties en ValidationException afin de produire
 *   le format d'erreur standardisé avec le code VALIDATION_ERROR.
 */
export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      // Les conversions sont explicites dans les DTO (@Type) : la
      // conversion implicite masquerait des entrées invalides.
      enableImplicitConversion: false,
    },
    validationError: {
      // Ne jamais renvoyer la valeur soumise : elle pourrait contenir
      // un secret (mot de passe invalide par exemple).
      value: false,
      target: false,
    },
    exceptionFactory: (errors: ValidationError[]) =>
      new ValidationException(flattenValidationErrors(errors)),
  });
}
