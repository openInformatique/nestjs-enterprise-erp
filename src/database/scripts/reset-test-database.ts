import * as sql from 'mssql';
import { loadScriptDatabaseEnvironment } from './script-environment';

/**
 * Réinitialise complètement la base de TEST : suppression puis recréation.
 *
 * Garde-fou : ce script refuse de toucher à toute base dont le nom ne se
 * termine pas par "_test", afin d'empêcher la destruction accidentelle
 * d'une base de travail.
 *
 * Usage : npm run db:reset:test
 */
async function resetTestDatabase(): Promise<void> {
  const env = loadScriptDatabaseEnvironment();
  const databaseName = env.testDatabase;

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refus de réinitialiser "${databaseName}" : le nom d'une base de test ` +
        `doit se terminer par "_test".`,
    );
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName)) {
    throw new Error(`Nom de base invalide : "${databaseName}".`);
  }

  const pool = await sql.connect({
    server: env.host,
    port: env.port,
    user: env.username,
    password: env.password,
    database: 'master',
    options: {
      encrypt: env.encrypt,
      trustServerCertificate: env.trustServerCertificate,
    },
  });

  try {
    // SINGLE_USER + ROLLBACK IMMEDIATE : ferme les connexions ouvertes
    // avant la suppression, sinon DROP DATABASE échoue.
    await pool.request().query(`
      IF DB_ID('${databaseName}') IS NOT NULL
      BEGIN
        ALTER DATABASE [${databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${databaseName}];
      END
    `);
    await pool.request().query(`CREATE DATABASE [${databaseName}]`);
    console.log(`✔ Base de test "${databaseName}" réinitialisée.`);
  } finally {
    await pool.close();
  }
}

resetTestDatabase()
  .then(() => {
    console.log('Réinitialisation de la base de test terminée.');
  })
  .catch((error: unknown) => {
    console.error('Échec de la réinitialisation de la base de test :', error);
    process.exit(1);
  });
