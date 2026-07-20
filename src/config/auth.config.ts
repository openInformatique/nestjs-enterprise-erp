import { registerAs } from '@nestjs/config';
import { SameSitePolicy } from './environment.validation';

/** Configuration de l'authentification JWT et du cookie de refresh token. */
export interface AuthConfig {
  accessTokenSecret: string;
  accessTokenExpiration: string;
  refreshTokenSecret: string;
  refreshTokenExpiration: string;
  refreshCookie: {
    name: string;
    secure: boolean;
    sameSite: SameSitePolicy;
    /** Domaine du cookie ; undefined en local. */
    domain?: string;
  };
}

export const authConfig = registerAs('auth', (): AuthConfig => ({
  accessTokenSecret: process.env.JWT_ACCESS_SECRET as string,
  accessTokenExpiration: process.env.JWT_ACCESS_EXPIRATION as string,
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET as string,
  refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRATION as string,
  refreshCookie: {
    name: process.env.REFRESH_COOKIE_NAME as string,
    secure: process.env.REFRESH_COOKIE_SECURE === 'true',
    sameSite: process.env.REFRESH_COOKIE_SAME_SITE as SameSitePolicy,
    domain: process.env.REFRESH_COOKIE_DOMAIN || undefined,
  },
}));
