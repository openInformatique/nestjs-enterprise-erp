import { ValidationError } from '@nestjs/common';
import { ValidationException } from '../exceptions/app-exceptions';
import {
  createGlobalValidationPipe,
  flattenValidationErrors,
} from './global-validation.pipe';

const buildError = (
  property: string,
  constraints: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({
  property,
  constraints,
  children,
});

describe('flattenValidationErrors', () => {
  it('aplati les erreurs simples en détails champ/message', () => {
    const details = flattenValidationErrors([
      buildError('email', { isEmail: 'L’adresse e-mail n’est pas valide.' }),
      buildError('password', { isNotEmpty: 'Le mot de passe est requis.' }),
    ]);

    expect(details).toEqual([
      { field: 'email', message: 'L’adresse e-mail n’est pas valide.' },
      { field: 'password', message: 'Le mot de passe est requis.' },
    ]);
  });

  it('préfixe le chemin des erreurs imbriquées', () => {
    const details = flattenValidationErrors([
      buildError('address', {}, [
        buildError('city', { isNotEmpty: 'La ville est requise.' }),
      ]),
    ]);

    expect(details).toEqual([
      { field: 'address.city', message: 'La ville est requise.' },
    ]);
  });

  it('produit un détail par contrainte violée', () => {
    const details = flattenValidationErrors([
      buildError('email', {
        isEmail: 'Format invalide.',
        maxLength: 'Trop long.',
      }),
    ]);

    expect(details).toHaveLength(2);
  });
});

describe('createGlobalValidationPipe', () => {
  it('produit une ValidationException avec le code VALIDATION_ERROR', async () => {
    const pipe = createGlobalValidationPipe();

    class Dto {}

    // Une propriété non déclarée doit être rejetée (forbidNonWhitelisted).
    await expect(
      pipe.transform({ unexpected: 'value' }, { type: 'body', metatype: Dto }),
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
