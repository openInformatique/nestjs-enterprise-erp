import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';
import { appConfig } from '../../../config/app.config';
import { authConfig } from '../../../config/auth.config';

/**
 * Gestion du cookie HttpOnly portant le refresh token.
 *
 * Politique :
 *   - HttpOnly : inaccessible au JavaScript du front ;
 *   - Secure et SameSite configurables par environnement ;
 *   - chemin limité aux routes d'authentification (/api/v1/auth) : le
 *     cookie n'est jamais envoyé au reste de l'API ;
 *   - expiration alignée sur celle du refresh token.
 */
@Injectable()
export class RefreshCookieService {
  private readonly cookiePath: string;

  constructor(
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
    @Inject(appConfig.KEY)
    app: ConfigType<typeof appConfig>,
  ) {
    this.cookiePath = `/${app.globalPrefix}/v${app.version}/auth`;
  }

  /** Nom du cookie (utile aux tests et à la documentation Swagger). */
  get cookieName(): string {
    return this.auth.refreshCookie.name;
  }

  /** Dépose ou remplace le cookie de refresh token. */
  set(response: Response, refreshToken: string, expiresAt: Date): void {
    response.cookie(this.cookieName, refreshToken, {
      httpOnly: true,
      secure: this.auth.refreshCookie.secure,
      sameSite: this.auth.refreshCookie.sameSite,
      domain: this.auth.refreshCookie.domain,
      path: this.cookiePath,
      expires: expiresAt,
    });
  }

  /** Supprime le cookie (logout). */
  clear(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.auth.refreshCookie.secure,
      sameSite: this.auth.refreshCookie.sameSite,
      domain: this.auth.refreshCookie.domain,
      path: this.cookiePath,
    });
  }

  /** Lit le refresh token depuis la requête (cookie-parser requis). */
  read(request: Request): string | undefined {
    // Express type `cookies` en any : re-typage strict local.
    const cookies = (request as { cookies?: unknown }).cookies;
    if (cookies === null || typeof cookies !== 'object') {
      return undefined;
    }
    const value = (cookies as Record<string, unknown>)[this.cookieName];
    return typeof value === 'string' ? value : undefined;
  }
}
