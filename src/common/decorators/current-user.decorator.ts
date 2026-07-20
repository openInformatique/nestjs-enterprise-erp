import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../interfaces/authenticated-user';

/** Requête Express enrichie par le guard JWT. */
export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Injecte l'utilisateur authentifié (type strict AuthenticatedUser)
 * dans un paramètre de handler.
 *
 * Exemple :
 *
 *   @Get('me')
 *   getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * Sur une route protégée, le guard JWT garantit la présence de
 * l'utilisateur ; sur une route @Public(), la valeur serait undefined
 * (ne pas utiliser ce décorateur sur une route publique).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    // Le guard JWT a déjà rejeté la requête si l'utilisateur est absent.
    return request.user as AuthenticatedUser;
  },
);
