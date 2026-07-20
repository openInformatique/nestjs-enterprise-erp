import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnée lue par le guard JWT global. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Déclare un endpoint PUBLIC : le guard JWT global le laisse passer
 * sans jeton d'accès.
 *
 * À réserver aux endpoints réellement publics : login, refresh, santé.
 * Toute route non décorée exige un access token valide.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
