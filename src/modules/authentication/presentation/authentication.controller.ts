import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user';
import { RefreshTokenInvalidException } from '../../../common/exceptions/app-exceptions';
import {
  THROTTLE_LIMIT_LOGIN,
  THROTTLE_LIMIT_REFRESH,
  THROTTLE_TTL_MS,
} from '../../../common/security/throttling.module';
import { GetUserByIdUseCase } from '../../users/application/get-user-by-id.use-case';
import { ListSessionsUseCase } from '../application/list-sessions.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutAllUseCase } from '../application/logout-all.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshTokensUseCase } from '../application/refresh-tokens.use-case';
import { RevokeSessionUseCase } from '../application/revoke-session.use-case';
import {
  AuthenticatedUserResponseDto,
  LoginResponseDto,
  LogoutAllResponseDto,
  RefreshResponseDto,
  SessionResponseDto,
} from './dto/auth-responses.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { RefreshCookieService } from './refresh-cookie.service';

/**
 * Contrôleur d'authentification.
 *
 * Volontairement léger : chaque handler délègue à un cas d'utilisation
 * et ne gère que les aspects HTTP (cookie de refresh token, statuts).
 */
@ApiTags('Authentification')
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokensUseCase: RefreshTokensUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllUseCase: LogoutAllUseCase,
    private readonly listSessionsUseCase: ListSessionsUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly refreshCookie: RefreshCookieService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT_LOGIN } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion locale (e-mail + mot de passe)',
    description:
      "Renvoie un jeton d'accès dans le corps et dépose le refresh token " +
      'dans un cookie HttpOnly limité aux routes /auth. ' +
      'Limité à 5 tentatives par minute et par IP.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Identifiants incorrects (code AUTHENTICATION_FAILED).',
  })
  @ApiTooManyRequestsResponse({
    description: 'Trop de tentatives (code TOO_MANY_REQUESTS).',
  })
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.loginUseCase.execute(body.email, body.password);

    this.refreshCookie.set(
      response,
      result.refreshToken.token,
      result.refreshToken.expiresAt,
    );

    return {
      accessToken: result.accessToken.token,
      accessTokenExpiresAt: result.accessToken.expiresAt.toISOString(),
      user: result.user,
    };
  }

  @Public()
  @Throttle({
    default: { ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT_REFRESH },
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Rotation des jetons via le cookie de refresh token',
    description:
      'Vérifie le refresh token du cookie, effectue la rotation ' +
      '(nouveau refresh token en cookie, ancien invalidé) et renvoie un ' +
      "nouveau jeton d'accès. La réutilisation d'un ancien token révoque " +
      'toute la famille de sessions (code REFRESH_TOKEN_REUSE_DETECTED).',
  })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Refresh token absent, invalide, expiré, session révoquée ou ' +
      'réutilisation détectée.',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken = this.refreshCookie.read(request);
    if (!refreshToken) {
      throw new RefreshTokenInvalidException();
    }

    const result = await this.refreshTokensUseCase.execute(refreshToken);

    this.refreshCookie.set(
      response,
      result.refreshToken.token,
      result.refreshToken.expiresAt,
    );

    return {
      accessToken: result.accessToken.token,
      accessTokenExpiresAt: result.accessToken.expiresAt.toISOString(),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Déconnexion de la session courante',
    description:
      'Révoque la session portée par le jeton d’accès et supprime le ' +
      'cookie de refresh token.',
  })
  @ApiNoContentResponse({ description: 'Session révoquée.' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logoutUseCase.execute(user.userId, user.sessionId);
    this.refreshCookie.clear(response);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Déconnexion de toutes les sessions de l'utilisateur",
  })
  @ApiOkResponse({ type: LogoutAllResponseDto })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutAllResponseDto> {
    const revokedSessions = await this.logoutAllUseCase.execute(user.userId);
    this.refreshCookie.clear(response);
    return { revokedSessions };
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Sessions actives de l'utilisateur connecté",
    description:
      'Un utilisateur ne voit que ses propres sessions dans cette version ' +
      'du socle.',
  })
  @ApiOkResponse({ type: [SessionResponseDto] })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.listSessionsUseCase.execute(user.userId);
    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      // SQL Server renvoie les uniqueidentifier en majuscules alors que
      // le claim JWT porte l'UUID généré en minuscules : comparaison
      // insensible à la casse obligatoire.
      isCurrent: session.id.toLowerCase() === user.sessionId.toLowerCase(),
    }));
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Révocation d’une session précise',
    description:
      "La session doit appartenir à l'utilisateur connecté ; sinon la " +
      'réponse est RESOURCE_NOT_FOUND (aucune fuite d’information).',
  })
  @ApiNoContentResponse({ description: 'Session révoquée.' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ): Promise<void> {
    await this.revokeSessionUseCase.execute(user.userId, sessionId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  @ApiOkResponse({ type: AuthenticatedUserResponseDto })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthenticatedUserResponseDto> {
    const profile = await this.getUserByIdUseCase.execute(user.userId);
    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
    };
  }
}
