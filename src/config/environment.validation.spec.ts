import {
  LogLevel,
  MailDriver,
  NodeEnvironment,
  SameSitePolicy,
  StorageDriver,
  validateEnvironment,
} from './environment.validation';

/**
 * Construit un jeu complet de variables d'environnement valides.
 * Chaque test part de cette base et introduit une anomalie ciblée.
 */
const buildValidEnvironment = (): Record<string, string> => ({
  NODE_ENV: 'local',
  APP_NAME: 'nestjs-enterprise-starter',
  APP_HOST: '0.0.0.0',
  APP_PORT: '3000',
  APP_GLOBAL_PREFIX: 'api',
  APP_VERSION: '1',
  APP_CORS_ORIGINS: 'http://localhost:3000',
  DB_HOST: 'localhost',
  DB_PORT: '1433',
  DB_USERNAME: 'sa',
  DB_PASSWORD: 'password-de-test',
  DB_DATABASE: 'nestjs_starter_local',
  DB_TEST_DATABASE: 'nestjs_starter_test',
  DB_ENCRYPT: 'true',
  DB_TRUST_SERVER_CERTIFICATE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_ACCESS_EXPIRATION: '15m',
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  JWT_REFRESH_EXPIRATION: '7d',
  REFRESH_COOKIE_NAME: 'refresh_token',
  REFRESH_COOKIE_SECURE: 'false',
  REFRESH_COOKIE_SAME_SITE: 'lax',
  REFRESH_COOKIE_DOMAIN: '',
  LOG_LEVEL: 'debug',
  SWAGGER_ENABLED: 'true',
  METRICS_ENABLED: 'true',
  SCHEDULER_ENABLED: 'true',
  TECHNICAL_DEMO_ENDPOINTS_ENABLED: 'true',
  MAIL_DRIVER: 'development',
  MAIL_HOST: 'localhost',
  MAIL_PORT: '1025',
  MAIL_USERNAME: '',
  MAIL_PASSWORD: '',
  MAIL_FROM: 'noreply@example.com',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_PATH: './uploads',
  STORAGE_MAX_FILE_SIZE: '10485760',
  STORAGE_ALLOWED_MIME_TYPES: 'application/pdf,image/png',
});

describe('validateEnvironment', () => {
  it('accepte une configuration complète et valide', () => {
    const result = validateEnvironment(buildValidEnvironment());

    expect(result.NODE_ENV).toBe(NodeEnvironment.Local);
    expect(result.APP_PORT).toBe(3000);
    expect(result.DB_ENCRYPT).toBe(true);
    expect(result.REFRESH_COOKIE_SECURE).toBe(false);
    expect(result.REFRESH_COOKIE_SAME_SITE).toBe(SameSitePolicy.Lax);
    expect(result.LOG_LEVEL).toBe(LogLevel.Debug);
    expect(result.MAIL_DRIVER).toBe(MailDriver.Development);
    expect(result.STORAGE_DRIVER).toBe(StorageDriver.Local);
    expect(result.STORAGE_MAX_FILE_SIZE).toBe(10485760);
  });

  it('refuse le démarrage lorsqu’une variable obligatoire est absente', () => {
    const environment = buildValidEnvironment();
    delete environment.DB_PASSWORD;

    expect(() => validateEnvironment(environment)).toThrow(
      /Configuration invalide, démarrage refusé/,
    );
    expect(() => validateEnvironment(environment)).toThrow(/DB_PASSWORD/);
  });

  it('refuse un NODE_ENV inconnu', () => {
    const environment = buildValidEnvironment();
    environment.NODE_ENV = 'production-inconnue';

    expect(() => validateEnvironment(environment)).toThrow(/NODE_ENV/);
  });

  it('refuse un port non numérique', () => {
    const environment = buildValidEnvironment();
    environment.APP_PORT = 'pas-un-port';

    expect(() => validateEnvironment(environment)).toThrow(/APP_PORT/);
  });

  it('refuse un booléen invalide plutôt que de le convertir silencieusement', () => {
    const environment = buildValidEnvironment();
    environment.SWAGGER_ENABLED = 'yes';

    expect(() => validateEnvironment(environment)).toThrow(/SWAGGER_ENABLED/);
  });

  it('refuse un secret JWT trop court', () => {
    const environment = buildValidEnvironment();
    environment.JWT_ACCESS_SECRET = 'trop-court';

    expect(() => validateEnvironment(environment)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('liste toutes les variables en erreur dans un même message', () => {
    const environment = buildValidEnvironment();
    delete environment.APP_NAME;
    delete environment.DB_HOST;

    try {
      validateEnvironment(environment);
      fail('La validation aurait dû échouer.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('APP_NAME');
      expect(message).toContain('DB_HOST');
    }
  });
});
