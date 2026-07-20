import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Environnements pris en charge par le socle.
 *
 * Volontairement limité à local / development / test : la production
 * sera ajoutée lorsque la cible d'hébergement sera connue.
 */
export enum NodeEnvironment {
  Local = 'local',
  Development = 'development',
  Test = 'test',
}

/** Niveaux de log acceptés par Pino. */
export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
}

/** Pilotes d'envoi d'e-mails disponibles. */
export enum MailDriver {
  /** Journalise les métadonnées sans envoyer réellement le message. */
  Development = 'development',
  /** Envoi réel via un serveur SMTP. */
  Smtp = 'smtp',
}

/** Pilotes de stockage de fichiers disponibles. */
export enum StorageDriver {
  Local = 'local',
}

/** Politiques SameSite acceptées pour le cookie de refresh token. */
export enum SameSitePolicy {
  Lax = 'lax',
  Strict = 'strict',
  None = 'none',
}

/**
 * Convertit une chaîne d'environnement en booléen strict.
 *
 * Seules les valeurs "true" et "false" (insensibles à la casse) sont
 * acceptées ; toute autre valeur est laissée telle quelle afin que
 * class-validator la rejette avec un message explicite.
 */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return value;
};

/** Convertit une chaîne d'environnement en entier, sans conversion silencieuse. */
const toInteger = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string' || value.trim() === '') {
    return value;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
};

/**
 * Déclaration exhaustive et typée des variables d'environnement.
 *
 * Chaque propriété est validée au démarrage : l'application refuse de
 * démarrer si une variable obligatoire est absente ou invalide.
 */
export class EnvironmentVariables {
  // --- Application ---------------------------------------------------------

  @IsEnum(NodeEnvironment, {
    message: 'NODE_ENV doit valoir "local", "development" ou "test".',
  })
  NODE_ENV!: NodeEnvironment;

  @IsString()
  @IsNotEmpty({ message: 'APP_NAME est obligatoire.' })
  APP_NAME!: string;

  @IsString()
  @IsNotEmpty({ message: 'APP_HOST est obligatoire (ex. : 0.0.0.0).' })
  APP_HOST!: string;

  @Transform(toInteger)
  @IsInt({ message: 'APP_PORT doit être un entier.' })
  @Min(1)
  @Max(65535)
  APP_PORT!: number;

  @IsString()
  @IsNotEmpty({ message: 'APP_GLOBAL_PREFIX est obligatoire (ex. : api).' })
  APP_GLOBAL_PREFIX!: string;

  @IsString()
  @IsNotEmpty({ message: 'APP_VERSION est obligatoire (ex. : 1).' })
  APP_VERSION!: string;

  /** Liste d'origines CORS séparées par des virgules. */
  @IsString()
  @IsNotEmpty({
    message:
      'APP_CORS_ORIGINS est obligatoire (origines séparées par des virgules).',
  })
  APP_CORS_ORIGINS!: string;

  // --- Base de données ------------------------------------------------------

  @IsString()
  @IsNotEmpty({ message: 'DB_HOST est obligatoire.' })
  DB_HOST!: string;

  @Transform(toInteger)
  @IsInt({ message: 'DB_PORT doit être un entier.' })
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty({ message: 'DB_USERNAME est obligatoire.' })
  DB_USERNAME!: string;

  @IsString()
  @IsNotEmpty({ message: 'DB_PASSWORD est obligatoire.' })
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty({ message: 'DB_DATABASE est obligatoire.' })
  DB_DATABASE!: string;

  @IsString()
  @IsNotEmpty({ message: 'DB_TEST_DATABASE est obligatoire.' })
  DB_TEST_DATABASE!: string;

  @Transform(toBoolean)
  @IsBoolean({ message: 'DB_ENCRYPT doit valoir "true" ou "false".' })
  DB_ENCRYPT!: boolean;

  @Transform(toBoolean)
  @IsBoolean({
    message: 'DB_TRUST_SERVER_CERTIFICATE doit valoir "true" ou "false".',
  })
  DB_TRUST_SERVER_CERTIFICATE!: boolean;

  // --- JWT -------------------------------------------------------------------

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères.',
  })
  JWT_ACCESS_SECRET!: string;

  /** Durée au format ms/jsonwebtoken (ex. : "15m", "1h"). */
  @IsString()
  @IsNotEmpty({ message: 'JWT_ACCESS_EXPIRATION est obligatoire (ex. : 15m).' })
  JWT_ACCESS_EXPIRATION!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_REFRESH_SECRET doit contenir au moins 32 caractères.',
  })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_REFRESH_EXPIRATION est obligatoire (ex. : 7d).' })
  JWT_REFRESH_EXPIRATION!: string;

  // --- Cookie de refresh token ------------------------------------------------

  @IsString()
  @IsNotEmpty({ message: 'REFRESH_COOKIE_NAME est obligatoire.' })
  REFRESH_COOKIE_NAME!: string;

  @Transform(toBoolean)
  @IsBoolean({
    message: 'REFRESH_COOKIE_SECURE doit valoir "true" ou "false".',
  })
  REFRESH_COOKIE_SECURE!: boolean;

  @IsEnum(SameSitePolicy, {
    message: 'REFRESH_COOKIE_SAME_SITE doit valoir "lax", "strict" ou "none".',
  })
  REFRESH_COOKIE_SAME_SITE!: SameSitePolicy;

  /** Domaine du cookie ; vide en local. */
  @IsOptional()
  @IsString()
  REFRESH_COOKIE_DOMAIN?: string;

  // --- Observabilité et fonctionnalités ---------------------------------------

  @IsEnum(LogLevel, {
    message:
      'LOG_LEVEL doit valoir "fatal", "error", "warn", "info", "debug" ou "trace".',
  })
  LOG_LEVEL!: LogLevel;

  @Transform(toBoolean)
  @IsBoolean({ message: 'SWAGGER_ENABLED doit valoir "true" ou "false".' })
  SWAGGER_ENABLED!: boolean;

  @Transform(toBoolean)
  @IsBoolean({ message: 'METRICS_ENABLED doit valoir "true" ou "false".' })
  METRICS_ENABLED!: boolean;

  @Transform(toBoolean)
  @IsBoolean({ message: 'SCHEDULER_ENABLED doit valoir "true" ou "false".' })
  SCHEDULER_ENABLED!: boolean;

  @Transform(toBoolean)
  @IsBoolean({
    message: 'TECHNICAL_DEMO_ENDPOINTS_ENABLED doit valoir "true" ou "false".',
  })
  TECHNICAL_DEMO_ENDPOINTS_ENABLED!: boolean;

  // --- E-mails -----------------------------------------------------------------

  @IsEnum(MailDriver, {
    message: 'MAIL_DRIVER doit valoir "development" ou "smtp".',
  })
  MAIL_DRIVER!: MailDriver;

  @IsString()
  @IsNotEmpty({ message: 'MAIL_HOST est obligatoire.' })
  MAIL_HOST!: string;

  @Transform(toInteger)
  @IsInt({ message: 'MAIL_PORT doit être un entier.' })
  @Min(1)
  @Max(65535)
  MAIL_PORT!: number;

  /** Identifiants SMTP facultatifs (serveur local sans authentification). */
  @IsOptional()
  @IsString()
  MAIL_USERNAME?: string;

  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @IsString()
  @IsNotEmpty({
    message: 'MAIL_FROM est obligatoire (ex. : noreply@example.com).',
  })
  MAIL_FROM!: string;

  // --- Stockage de fichiers ------------------------------------------------------

  @IsEnum(StorageDriver, { message: 'STORAGE_DRIVER doit valoir "local".' })
  STORAGE_DRIVER!: StorageDriver;

  @IsString()
  @IsNotEmpty({ message: 'STORAGE_LOCAL_PATH est obligatoire.' })
  STORAGE_LOCAL_PATH!: string;

  /** Taille maximale d'un fichier en octets. */
  @Transform(toInteger)
  @IsInt({ message: 'STORAGE_MAX_FILE_SIZE doit être un entier (octets).' })
  @Min(1)
  STORAGE_MAX_FILE_SIZE!: number;

  /** Types MIME autorisés, séparés par des virgules. */
  @IsString()
  @IsNotEmpty({
    message:
      'STORAGE_ALLOWED_MIME_TYPES est obligatoire (types séparés par des virgules).',
  })
  STORAGE_ALLOWED_MIME_TYPES!: string;
}

/**
 * Valide l'environnement au démarrage de l'application.
 *
 * En cas d'échec, une erreur listant précisément chaque variable
 * manquante ou invalide est levée : l'application refuse de démarrer.
 */
export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    // Les transformations explicites (@Transform) suffisent ; la conversion
    // implicite masquerait des valeurs invalides.
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(' ; ')
          : 'valeur invalide';
        return `  - ${error.property} : ${constraints}`;
      })
      .join('\n');

    throw new Error(
      `Configuration invalide, démarrage refusé.\n` +
        `Variables d'environnement en erreur :\n${details}\n` +
        `Consultez les fichiers .env.example pour la liste des variables attendues.`,
    );
  }

  return validated;
}
