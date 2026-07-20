import { registerAs } from '@nestjs/config';

/** Configuration de la connexion SQL Server. */
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  /** Base principale de l'environnement courant. */
  database: string;
  /** Base réservée aux tests d'intégration et end-to-end. */
  testDatabase: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  host: process.env.DB_HOST as string,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME as string,
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_DATABASE as string,
  testDatabase: process.env.DB_TEST_DATABASE as string,
  encrypt: process.env.DB_ENCRYPT === 'true',
  trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
}));
