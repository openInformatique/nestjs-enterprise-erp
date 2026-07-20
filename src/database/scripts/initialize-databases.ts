import * as sql from 'mssql';
import { loadScriptDatabaseEnvironment } from './script-environment';

/**
 * Crée les bases applicatives si elles n'existent pas encore :
 *   - la base principale (DB_DATABASE, ex. nestjs_starter_local) ;
 *   - la base de test (DB_TEST_DATABASE, ex. nestjs_starter_test),
 *     réservée aux tests d'intégration et end-to-end.
 *
 * Le script est idempotent : le relancer sur des bases existantes
 * ne produit aucune modification.
 *
 * Usage : npm run db:init
 */
async function initializeDatabases(): Promise<void> {
  const env = loadScriptDatabaseEnvironment();

  // Connexion à la base système master : les bases applicatives
  // n'existent peut-être pas encore.
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
    for (const databaseName of [env.database, env.testDatabase]) {
      // Le nom provient de la configuration (jamais d'une entrée utilisateur) ;
      // il est néanmoins validé pour éviter toute construction SQL dangereuse.
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName)) {
        throw new Error(
          `Nom de base invalide : "${databaseName}". ` +
            `Seuls les lettres, chiffres et underscores sont autorisés.`,
        );
      }

      const result = await pool
        .request()
        .input('name', sql.NVarChar, databaseName)
        .query<{ databaseId: number | null }>(
          'SELECT DB_ID(@name) AS databaseId',
        );

      const alreadyExists =
        result.recordset[0]?.databaseId !== null &&
        result.recordset[0]?.databaseId !== undefined;

      if (alreadyExists) {
        console.log(`✔ La base "${databaseName}" existe déjà, aucune action.`);
        continue;
      }

      await pool.request().query(`CREATE DATABASE [${databaseName}]`);
      console.log(`✔ Base "${databaseName}" créée.`);
    }
  } finally {
    await pool.close();
  }
}

initializeDatabases()
  .then(() => {
    console.log('Initialisation des bases terminée.');
  })
  .catch((error: unknown) => {
    console.error("Échec de l'initialisation des bases :", error);
    process.exit(1);
  });
