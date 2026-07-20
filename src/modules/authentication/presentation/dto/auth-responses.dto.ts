import { ApiProperty } from '@nestjs/swagger';

/** Profil minimal renvoyé après login et sur GET /auth/me. */
export class AuthenticatedUserResponseDto {
  @ApiProperty({ description: "Identifiant de l'utilisateur (UUID)." })
  id!: string;

  @ApiProperty({ example: 'admin@local.dev' })
  email!: string;

  @ApiProperty({ example: 'Administrateur local' })
  displayName!: string;
}

/**
 * Réponse de POST /auth/login et POST /auth/refresh.
 *
 * L'access token est renvoyé dans le corps ; le refresh token n'apparaît
 * JAMAIS ici : il est déposé dans un cookie HttpOnly.
 */
export class LoginResponseDto {
  @ApiProperty({ description: "Jeton d'accès JWT (Authorization: Bearer)." })
  accessToken!: string;

  @ApiProperty({
    description: "Expiration du jeton d'accès (ISO 8601, UTC).",
    example: '2026-07-14T09:00:00.000Z',
  })
  accessTokenExpiresAt!: string;

  @ApiProperty({ type: AuthenticatedUserResponseDto })
  user!: AuthenticatedUserResponseDto;
}

/** Réponse de POST /auth/refresh (le profil n'est pas rechargé). */
export class RefreshResponseDto {
  @ApiProperty({ description: "Nouveau jeton d'accès JWT." })
  accessToken!: string;

  @ApiProperty({
    description: "Expiration du nouveau jeton d'accès (ISO 8601, UTC).",
  })
  accessTokenExpiresAt!: string;
}

/** Session active renvoyée par GET /auth/sessions. */
export class SessionResponseDto {
  @ApiProperty({ description: 'Identifiant de la session (UUID).' })
  id!: string;

  @ApiProperty({
    description: 'Navigateur / client à l’origine de la session.',
    nullable: true,
  })
  userAgent!: string | null;

  @ApiProperty({ description: 'Adresse IP à la création.', nullable: true })
  ipAddress!: string | null;

  @ApiProperty({
    description: 'Dernier rafraîchissement de jeton.',
    nullable: true,
  })
  lastUsedAt!: Date | null;

  @ApiProperty({ description: 'Expiration de la session.' })
  expiresAt!: Date;

  @ApiProperty({ description: 'Création de la session.' })
  createdAt!: Date;

  @ApiProperty({
    description: 'True pour la session utilisée par la requête courante.',
  })
  isCurrent!: boolean;
}

/** Réponse de POST /auth/logout-all. */
export class LogoutAllResponseDto {
  @ApiProperty({ description: 'Nombre de sessions révoquées.' })
  revokedSessions!: number;
}
