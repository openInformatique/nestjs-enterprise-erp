import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Paramètres de connexion SQL Server utilisés par les scripts CLI
 * (initialisation des bases, nettoyage de la base de test, seeders).
 */
export interface ScriptDatabaseEnvironment {
  nodeEnv: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  testDatabase: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

/**
 * Charge le fichier .env correspondant à NODE_ENV pour les scripts
 * exécutés hors NestJS (ts-node). Reproduit la convention du
 * ConfigurationModule : `.env.<NODE_ENV>` puis `.env` en repli.
 *
 * Lève une erreur explicite si une variable obligatoire manque :
 * les scripts ne doivent jamais s'exécuter avec une configuration partielle.
 */
export function loadScriptDatabaseEnvironment(): ScriptDatabaseEnvironment {
  const nodeEnv = process.env.NODE_ENV ?? 'local';

  for (const candidate of [`.env.${nodeEnv}`, '.env']) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) {
      loadDotenv({ path });
      break;
    }
  }

  const required = (name: string): string => {
    const value = process.env[name];
    if (value === undefined || value.trim() === '') {
      throw new Error(
        `Variable d'environnement manquante pour le script : ${name}. ` +
          `Vérifiez le fichier .env.${nodeEnv}.`,
      );
    }
    return value;
  };

  return {
    nodeEnv,
    host: required('DB_HOST'),
    port: Number(required('DB_PORT')),
    username: required('DB_USERNAME'),
    password: required('DB_PASSWORD'),
    database: required('DB_DATABASE'),
    testDatabase: required('DB_TEST_DATABASE'),
    encrypt: required('DB_ENCRYPT') === 'true',
    trustServerCertificate: required('DB_TRUST_SERVER_CERTIFICATE') === 'true',
  };
}
