import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../../../common/context/request-context.service';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { RequestWithUser } from '../../../common/decorators/current-user.decorator';
import { AccessTokenInvalidException } from '../../../common/exceptions/app-exceptions';
import { TokenService } from '../application/token.service';

/**
 * Guard JWT global : toute route exige un access token Bearer valide,
 * SAUF celles explicitement décorées @Public().
 *
 * En cas de succès :
 *   - request.user reçoit l'AuthenticatedUser strict (userId, sessionId) ;
 *   - le contexte de requête est enrichi (logs et audits corrélés).
 *
 * Choix documenté : le guard ne vérifie PAS l'état de la session en base
 * à chaque requête. Un access token déjà émis reste donc valide jusqu'à
 * sa courte expiration, même si la session vient d'être révoquée
 * (voir docs/authentication.md pour l'ajout d'une vérification
 * systématique si le besoin apparaît).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly requestContext: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new AccessTokenInvalidException();
    }

    const payload = await this.tokenService.verifyAccessToken(token);

    request.user = { userId: payload.sub, sessionId: payload.sid };
    this.requestContext.update({
      userId: payload.sub,
      sessionId: payload.sid,
    });

    return true;
  }

  private extractBearerToken(request: RequestWithUser): string | undefined {
    const header = request.get('authorization');
    if (!header) {
      return undefined;
    }
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
